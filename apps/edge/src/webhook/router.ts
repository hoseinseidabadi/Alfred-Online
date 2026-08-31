import { checkMembership, MEMBERSHIP_CACHE_TTL_MS } from '../access/membership';
import type { ConversationDO } from '../conversation/conversation.do';
import { messages, questionMessage } from '../conversation/messages';
import { isComplete } from '../conversation/state-machine';
import type { Env } from '../env';
import { completeSubmission } from '../submission/complete';
import type { DestinationAdapter } from '../telegram/adapter';
import {
  type Actor,
  MAX_ATTACHMENT_BYTES,
  type ParsedUpdate,
  type TelegramUpdate,
  parseUpdate,
} from './update';

/**
 * مسیریاب webhook — T040.
 *
 * اینجا همه‌چیز به هم وصل می‌شود: دسترسی (T033)، گفت‌وگو (T036)، پیوست
 * (T038)، و کامل کردن ثبت (T041).
 *
 * **این تابع هیچ‌وقت پرتاب نمی‌کند.** تلگرام هر پاسخ غیر-۲xx را تلاش ناموفق
 * حساب می‌کند و همان بروزرسانی را دوباره می‌فرستد؛ اگر خطای ما باعثش شود،
 * حلقهٔ بی‌پایان می‌سازد. خطاها لاگ می‌شوند و پاسخ همیشه ۲۰۰ است.
 */

export interface RouterDeps {
  env: Env;
  adapter: DestinationAdapter;
  now?: () => number;
}

export async function handleUpdate(raw: TelegramUpdate, deps: RouterDeps): Promise<void> {
  const parsed = parseUpdate(raw);
  if (parsed.kind === 'ignored') return;

  try {
    await route(parsed, deps);
  } catch (error) {
    console.error('پردازش بروزرسانی شکست خورد:', error);
    await say(deps, parsed.actor, messages.unexpected);
  }
}

async function route(update: Exclude<ParsedUpdate, { kind: 'ignored' }>, deps: RouterDeps) {
  const { actor } = update;

  // دسترسی پیش از هر کاری — FR-001. حتی `/help` هم برای غیرعضو باز نیست:
  // پاسخ دادن به غیرعضو یعنی تأیید ضمنی اینکه سامانه‌ای هست که او در آن جایی
  // ندارد، و منشور P-06 نقطهٔ ورود را «سطح کارمندان» تعریف کرده.
  const access = await ensureAccess(deps, actor);
  if (access !== 'allowed') {
    await say(deps, actor, access === 'denied' ? messages.notMember : messages.accessUnknown);
    return;
  }

  switch (update.kind) {
    case 'command':
      return handleCommand(update.command, actor, deps);
    case 'answer':
      return handleAnswer(update.value, actor, deps);
    case 'attachment':
      return handleAttachment(update.attachment, actor, deps);
    case 'statusQuery':
      // FR-035 — پیاده‌سازی کاملش در T067 که به هسته نیاز دارد.
      return say(deps, actor, messages.notFound);
  }
}

// ── دسترسی ──────────────────────────────────────────────────────────────────

type AccessOutcome = 'allowed' | 'denied' | 'unknown';

async function ensureAccess(deps: RouterDeps, actor: Actor): Promise<AccessOutcome> {
  const conversation = conversationFor(deps.env, actor.chatId);
  const now = (deps.now ?? Date.now)();

  const cached = await conversation.cachedMembership(now);
  if (cached !== null) return cached ? 'allowed' : 'denied';

  const verdict = await checkMembership(deps.env.TELEGRAM_TOKEN, deps.env.CHANNEL_ID, actor.userId);

  // «نامعلوم» **کش نمی‌شود** — قید طراحی spike S-1. وگرنه یک قطعی
  // چندثانیه‌ای تلگرام تا انقضای کش کاربر را بیرون نگه می‌دارد.
  if (verdict.access === 'unknown') return 'unknown';

  await conversation.cacheMembership(verdict.access === 'allowed', now, MEMBERSHIP_CACHE_TTL_MS);
  return verdict.access;
}

// ── دستورها ─────────────────────────────────────────────────────────────────

async function handleCommand(
  command: 'start' | 'cancel' | 'help',
  actor: Actor,
  deps: RouterDeps,
): Promise<void> {
  const conversation = conversationFor(deps.env, actor.chatId);
  const now = (deps.now ?? Date.now)();

  if (command === 'help') return say(deps, actor, messages.help);

  if (command === 'cancel') {
    await conversation.abandon(now);
    return say(deps, actor, messages.cancelled);
  }

  const snapshot = await conversation.snapshot(now);
  if (snapshot.expired) {
    await say(deps, actor, messages.expired);
    const question = await conversation.restart(now);
    return askNext(deps, actor, question);
  }

  const begun = await conversation.begin(now);
  if (begun.needsConfirm) {
    // بی‌صدا جایگزین نمی‌شود — کاربر انتخاب می‌کند.
    return say(deps, actor, messages.alreadyInProgress, messages.resumeChoices);
  }

  await say(deps, actor, messages.welcome);
  return askNext(deps, actor, begun.question);
}

// ── پاسخ‌ها ─────────────────────────────────────────────────────────────────

async function handleAnswer(value: string, actor: Actor, deps: RouterDeps): Promise<void> {
  const conversation = conversationFor(deps.env, actor.chatId);
  const now = (deps.now ?? Date.now)();

  // گزینه‌های کنترلی، نه پاسخ به پرسش.
  if (value === '__resume') {
    const { question } = await conversation.snapshot(now);
    return askNext(deps, actor, question);
  }
  if (value === '__restart') {
    return askNext(deps, actor, await conversation.restart(now));
  }
  if (value === '__done') {
    return finish(actor, deps);
  }

  const result = await conversation.submitAnswer(value, now);
  if (!result.ok) {
    const complaint =
      result.reason === 'invalid_choice' ? messages.invalidChoice : messages.emptyAnswer;
    await say(deps, actor, complaint);
    const { question } = await conversation.snapshot(now);
    return askNext(deps, actor, question);
  }

  const { question } = await conversation.snapshot(now);
  if (question !== null) return askNext(deps, actor, question);

  // پرسش‌ها تمام شد — نوبت پیوست اختیاری.
  return say(deps, actor, messages.attachmentPrompt, messages.attachmentChoices);
}

// ── پیوست — T038، FR-011 ────────────────────────────────────────────────────

async function handleAttachment(
  attachment: { kind: 'photo' | 'document' | 'link'; ref: string; sizeBytes?: number },
  actor: Actor,
  deps: RouterDeps,
): Promise<void> {
  const conversation = conversationFor(deps.env, actor.chatId);
  const now = (deps.now ?? Date.now)();

  if ((attachment.sizeBytes ?? 0) > MAX_ATTACHMENT_BYTES) {
    // **ثبت متوقف نمی‌شود** — پیام روشن و ادامه (FR-011).
    return say(deps, actor, messages.attachmentTooLarge, messages.attachmentChoices);
  }

  await conversation.attach({ kind: attachment.kind, ref: attachment.ref }, now);
  return say(deps, actor, messages.attachmentAccepted, messages.attachmentChoices);
}

// ── پایان ثبت ───────────────────────────────────────────────────────────────

async function finish(actor: Actor, deps: RouterDeps): Promise<void> {
  const conversation = conversationFor(deps.env, actor.chatId);
  const now = (deps.now ?? Date.now)();
  const { state } = await conversation.snapshot(now);

  if (!isComplete(state) || state.unit === undefined || state.requestType === undefined) {
    // نباید رخ دهد، ولی ثبت ناقص به هسته نمی‌رود.
    const { question } = await conversation.snapshot(now);
    return askNext(deps, actor, question);
  }

  const { confirmationText } = await completeSubmission(deps.env, {
    chatId: actor.chatId,
    submitterName: actor.displayName,
    unit: state.unit,
    requestType: state.requestType,
    rawAnswers: state.answers,
    attachments: state.attachments,
    submittedAt: now,
  });

  await conversation.markSubmitted(now);
  await say(deps, actor, confirmationText);
}

// ── کمکی ────────────────────────────────────────────────────────────────────

function conversationFor(env: Env, chatId: string): DurableObjectStub<ConversationDO> {
  return env.CONVERSATION.get(
    env.CONVERSATION.idFromName(chatId),
  ) as DurableObjectStub<ConversationDO>;
}

async function askNext(
  deps: RouterDeps,
  actor: Actor,
  question: Parameters<typeof questionMessage>[0] | null,
): Promise<void> {
  if (question === null) {
    return say(deps, actor, messages.attachmentPrompt, messages.attachmentChoices);
  }
  const { text, choices } = questionMessage(question);
  return say(deps, actor, text, choices);
}

async function say(
  deps: RouterDeps,
  actor: Actor,
  text: string,
  choices?: readonly { value: string; label: string }[],
): Promise<void> {
  await deps.adapter.send({ recipient: actor.chatId, text, choices });
}

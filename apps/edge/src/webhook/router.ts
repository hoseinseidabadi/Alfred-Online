import { checkMembership, MEMBERSHIP_CACHE_TTL_MS } from '../access/membership';
import type { ConversationDO } from '../conversation/conversation.do';
import { messages, questionMessage } from '../conversation/messages';
import { isAwaitingAttachment, isComplete } from '../conversation/state-machine';
import type { Env } from '../env';
import { completeSubmission } from '../submission/complete';
import { findSubmission } from '../submission/store';
import { describeStatus } from '../submission/status';
import { deskMessages, isProductManager } from '../triage/desk';
import * as desk from '../triage/router';
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

  // میز تریاژ **پیش از** جریان ثبت بررسی می‌شود.
  //
  // مدیر محصول هم ثبت‌کننده است؛ اگر ترتیب برعکس بود، متنی که برای پاسخ
  // می‌نویسد به‌عنوان جواب یک پرسشِ ثبت تفسیر می‌شد.
  if (isProductManager(actor.chatId, deps.env)) {
    if (await routeDesk(update, actor, deps)) return;
  }

  switch (update.kind) {
    case 'command':
      return handleCommand(update.command, actor, deps);
    case 'answer':
      return handleAnswer(update.value, actor, deps);
    case 'attachment':
      return handleAttachment(update.attachment, actor, deps);
    case 'statusQuery':
      return handleStatusQuery(update.requestId, actor, deps);
  }
}

/**
 * مسیریابی میز تریاژ. `true` یعنی این بروزرسانی مصرف شد.
 *
 * فقط برای مدیر محصول صدا زده می‌شود — بررسی دسترسی در `route` انجام شده.
 */
async function routeDesk(
  update: Exclude<ParsedUpdate, { kind: 'ignored' }>,
  actor: Actor,
  deps: RouterDeps,
): Promise<boolean> {
  const deskDeps = { env: deps.env, adapter: deps.adapter, now: deps.now };

  if (update.kind === 'command' && update.command === 'inbox') {
    await desk.showInbox(deskDeps, actor, null);
    return true;
  }

  if (update.kind === 'answer') {
    const value = update.value;

    const reply = /^__reply:(.+)$/.exec(value);
    if (reply?.[1] !== undefined) {
      await desk.beginReply(deskDeps, actor, reply[1]);
      return true;
    }

    if (value.startsWith('__outcome:')) {
      await desk.chooseOutcome(deskDeps, actor, value);
      return true;
    }

    if (value === '__desk_cancel') {
      await desk.cancelReply(deskDeps, actor);
      return true;
    }

    const inbox = /^__inbox:(bug|improvement|idea|all)$/.exec(value);
    if (inbox?.[1] !== undefined) {
      const filter = inbox[1] === 'all' ? null : (inbox[1] as 'bug' | 'improvement' | 'idea');
      await desk.showInbox(deskDeps, actor, filter);
      return true;
    }

    // متن آزاد وسط جریان پاسخ — میز خودش تصمیم می‌گیرد مصرفش کند یا نه.
    return desk.handleDeskText(deskDeps, actor, value);
  }

  return false;
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
  command: 'start' | 'cancel' | 'help' | 'inbox',
  actor: Actor,
  deps: RouterDeps,
): Promise<void> {
  const conversation = conversationFor(deps.env, actor.chatId);
  const now = (deps.now ?? Date.now)();

  if (command === 'inbox') {
    // برای غیرمدیر، `/inbox` اصلاً وجود ندارد — نه پیام خطا، نه اشاره‌ای که
    // چنین چیزی هست. راهنمای عادی داده می‌شود.
    return say(deps, actor, messages.help);
  }

  if (command === 'help') {
    const text = isProductManager(actor.chatId, deps.env)
      ? `${messages.help}

${deskMessages.deskHelp}`
      : messages.help;
    return say(deps, actor, text);
  }

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
  if (value === '__begin') {
    return handleCommand('start', actor, deps);
  }
  if (value === '__cancel') {
    return handleCommand('cancel', actor, deps);
  }
  if (value === '__done') {
    // «تمام» فقط در گام پیوست معنا دارد. بدون این بررسی، یک «تمام» تصادفی
    // ثبت را تمام‌شده اعلام می‌کرد — همان چیزی که کاربر در تست واقعی دید.
    const { state } = await conversation.snapshot(now);
    if (!isAwaitingAttachment(state))
      return say(deps, actor, messages.idleHint, messages.startChoices);
    return finish(actor, deps);
  }

  const result = await conversation.submitAnswer(value, now);
  if (!result.ok) {
    // «هیچ پرسشی مطرح نیست» با «جوابت خالی بود» یکی نیست. قاطی کردنشان کاربر
    // را در تست واقعی به بن‌بست برد: پیام گیج‌کننده گرفت و بعد پرسش پیوست.
    if (result.reason === 'not_asking') {
      return say(deps, actor, messages.idleHint, messages.startChoices);
    }
    const complaint =
      result.reason === 'invalid_choice' ? messages.invalidChoice : messages.emptyAnswer;
    await say(deps, actor, complaint);
    const { question } = await conversation.snapshot(now);
    return askNext(deps, actor, question);
  }

  const { question, state } = await conversation.snapshot(now);
  if (question !== null) return askNext(deps, actor, question);
  if (isAwaitingAttachment(state)) return promptAttachments(deps, actor);
  return say(deps, actor, messages.idleHint, messages.startChoices);
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

  if (!isAwaitingAttachment(state)) {
    return say(deps, actor, messages.idleHint, messages.startChoices);
  }
  if (!isComplete(state) || state.unit === undefined || state.requestType === undefined) {
    // نباید رخ دهد، ولی ثبت ناقص به هسته نمی‌رود.
    const { question } = await conversation.snapshot(now);
    return askNext(deps, actor, question);
  }

  const { requestId, confirmationText } = await completeSubmission(deps.env, {
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

  // اعلان به مدیر محصول — **پس از** تأیید به ثبت‌کننده.
  //
  // ترتیب مهم است: اگر اعلان اول بود و شکست می‌خورد، ثبت‌کننده دیرتر شماره‌اش
  // را می‌دید. تعهد ما به اوست، نه به میز تریاژ.
  const submission = await findSubmission(deps.env.DB, requestId);
  if (submission !== null) {
    await desk.notifyNewBug({ env: deps.env, adapter: deps.adapter, now: deps.now }, submission);
  }
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
  // سقوط به پرسش پیوست حذف شد: «پرسشی نمانده» با «نوبت پیوست است» یکی نیست،
  // و قاطی کردنشان همان باگی بود که ثبت بی‌ربط می‌ساخت. تصمیم با فراخواننده است.
  if (question === null) return promptAttachments(deps, actor);
  const { text, choices } = questionMessage(question);
  // دکمهٔ لغو کنار هر پرسش — کاربر نباید دستور /cancel را حفظ باشد.
  return say(deps, actor, text, [...(choices ?? []), messages.cancelChoice]);
}

async function say(
  deps: RouterDeps,
  actor: Actor,
  text: string,
  choices?: readonly { value: string; label: string }[],
): Promise<void> {
  await deps.adapter.send({ recipient: actor.chatId, text, choices });
}

/** پرسش پیوست — تنها جایی که «تمام» معنا دارد. */
async function promptAttachments(deps: RouterDeps, actor: Actor): Promise<void> {
  return say(deps, actor, messages.attachmentPrompt, [
    ...messages.attachmentChoices,
    messages.cancelChoice,
  ]);
}

/**
 * استعلام وضعیت با شمارهٔ پیگیری — FR-035.
 *
 * لبه خودش جواب می‌دهد و منتظر هسته نمی‌ماند (اصل III). در قطعی، کسی که
 * شمارهٔ پیگیری در دست دارد نباید بشنود «پیدا نکردم».
 */
async function handleStatusQuery(requestId: string, actor: Actor, deps: RouterDeps): Promise<void> {
  const status = await describeStatus(deps.env, requestId, actor.chatId, (deps.now ?? Date.now)());
  return say(deps, actor, status ?? messages.notFound);
}

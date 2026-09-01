import type { ConversationDO } from '../conversation/conversation.do';
import type { Env } from '../env';
import { findSubmission, type StoredSubmission } from '../submission/store';
import type { DestinationAdapter } from '../telegram/adapter';
import type { Actor } from '../webhook/update';
import {
  OUTCOME_CHOICES,
  type QuickDecisionInput,
  composeResponseBody,
  validateQuickDecision,
} from './decision';
import { deskMessages, outcomeFromChoice, replyChoicesFor, summarize } from './desk';
import { isReadyToSend } from './session';
import {
  alreadyAnswered,
  issueResponseId,
  markDeliveredToUser,
  persistDecision,
  untriaged,
} from './store';

/**
 * میز تریاژ تلگرامی — رو به مدیر محصول.
 *
 * ترتیب کارها در `send` تصادفی نیست و همان منطق `completeSubmission` را دارد:
 *
 *   ۱. اعتبارسنجی — **پیش از هر چیز**
 *   ۲. صدور شماره و بادوام کردن در D1
 *   ۳. تحویل به ثبت‌کننده
 *   ۴. علامت زدن تحویل
 *
 * تحویل **پیش از** رسیدن به هسته انجام می‌شود (اصل III). پس اگر گام ۱ نبود،
 * ممکن بود چیزی بفرستیم که هسته بعداً با `422` ردش کند — و آن پیام دیگر
 * برگشتنی نیست.
 */

export interface DeskDeps {
  env: Env;
  adapter: DestinationAdapter;
  now?: () => number;
}

const conversationFor = (env: Env, chatId: string): DurableObjectStub<ConversationDO> =>
  env.CONVERSATION.get(env.CONVERSATION.idFromName(chatId)) as DurableObjectStub<ConversationDO>;

const say = (
  deps: DeskDeps,
  chatId: string,
  text: string,
  choices?: readonly { value: string; label: string }[],
) => deps.adapter.send({ recipient: chatId, text, choices });

// ── اعلان خرابی تازه ────────────────────────────────────────────────────────

/**
 * خرابی تازه را همان لحظه به مدیر محصول می‌رساند.
 *
 * **فقط خرابی** — بهبود و ایده هفت روز مهلت دارند و اعلان لحظه‌ای برایشان
 * فقط نویز است. آن‌ها با `/inbox` کشیده می‌شوند.
 *
 * شکستش بلعیده می‌شود: اعلان نرسیدن نباید ثبتِ کاربر را خراب کند.
 */
export async function notifyNewBug(deps: DeskDeps, submission: StoredSubmission): Promise<void> {
  const pm = deps.env.PRODUCT_MANAGER_CHAT_ID?.trim();
  if (pm === undefined || pm.length === 0) return;
  if (submission.requestType !== 'bug') return;
  // اگر خودِ مدیر محصول ثبت کرده، اعلان بی‌معناست.
  if (submission.chatId === pm) return;

  const now = (deps.now ?? Date.now)();
  try {
    await say(
      deps,
      pm,
      [deskMessages.newBugAlert, '', summarize(submission, now)].join('\n'),
      replyChoicesFor(submission.requestId),
    );
  } catch (error) {
    console.error('اعلان خرابی به مدیر محصول نرسید:', error);
  }
}

// ── صندوق ورودی ─────────────────────────────────────────────────────────────

export async function showInbox(
  deps: DeskDeps,
  actor: Actor,
  type: 'bug' | 'improvement' | 'idea' | null,
): Promise<void> {
  const now = (deps.now ?? Date.now)();
  const items = await untriaged(deps.env.DB, type);

  if (items.length === 0) {
    return void (await say(deps, actor.chatId, deskMessages.emptyInbox, deskMessages.inboxFilters));
  }

  await say(deps, actor.chatId, deskMessages.inboxHeader(items.length), deskMessages.inboxFilters);
  for (const item of items) {
    await say(deps, actor.chatId, summarize(item, now), replyChoicesFor(item.requestId));
  }
}

// ── جریان پاسخ ──────────────────────────────────────────────────────────────

/** «پاسخ می‌دهم» زده شد. */
export async function beginReply(deps: DeskDeps, actor: Actor, requestId: string): Promise<void> {
  const submission = await findSubmission(deps.env.DB, requestId);
  if (submission === null) {
    return void (await say(deps, actor.chatId, deskMessages.notFound));
  }
  if (await alreadyAnswered(deps.env.DB, requestId)) {
    return void (await say(deps, actor.chatId, deskMessages.alreadyAnswered));
  }

  await conversationFor(deps.env, actor.chatId).deskBeginReply(requestId, (deps.now ?? Date.now)());
  await say(deps, actor.chatId, deskMessages.chooseOutcome, [
    ...OUTCOME_CHOICES,
    { value: '__desk_cancel', label: 'بی‌خیال' },
  ]);
}

/** سرنوشت انتخاب شد. */
export async function chooseOutcome(deps: DeskDeps, actor: Actor, choice: string): Promise<void> {
  const outcome = outcomeFromChoice(choice);
  if (outcome === null) return;

  const state = await conversationFor(deps.env, actor.chatId).deskChooseOutcome(outcome);

  if (outcome === 'reject') {
    await say(deps, actor.chatId, deskMessages.rejectIntro);
    return void (await say(deps, actor.chatId, deskMessages.askUnderstood));
  }
  void state;
  return void (await say(deps, actor.chatId, deskMessages.askBody));
}

/**
 * یک پاسخ متنی در جریان میز.
 * برمی‌گرداند: آیا این پیام مصرف شد (یعنی مسیریاب اصلی نباید دستش بزند).
 */
export async function handleDeskText(deps: DeskDeps, actor: Actor, text: string): Promise<boolean> {
  const conversation = conversationFor(deps.env, actor.chatId);
  const before = await conversation.deskSnapshot();
  if (before.step === 'idle') return false;

  const after = await conversation.deskAnswer(text);

  switch (after.step) {
    case 'askWhyNot':
      await say(deps, actor.chatId, deskMessages.askWhyNot);
      return true;
    case 'askWhenYes':
      await say(deps, actor.chatId, deskMessages.askWhenYes);
      return true;
    default:
      break;
  }

  if (isReadyToSend(after)) await send(deps, actor);
  return true;
}

export async function cancelReply(deps: DeskDeps, actor: Actor): Promise<void> {
  await conversationFor(deps.env, actor.chatId).deskReset((deps.now ?? Date.now)());
  await say(deps, actor.chatId, deskMessages.cancelled);
}

/**
 * پاسخ را می‌سازد، بادوام می‌کند و تحویل می‌دهد.
 *
 * هرگز پرتاب نمی‌کند: شکست تحویل یک واقعیت است، نه استثنا — و مدیر محصول باید
 * بداند که متن ذخیره شده ولی نرسیده، نه اینکه خطای مبهم ببیند.
 */
async function send(deps: DeskDeps, actor: Actor): Promise<void> {
  const conversation = conversationFor(deps.env, actor.chatId);
  const state = await conversation.deskSnapshot();
  const now = (deps.now ?? Date.now)();

  if (state.requestId === undefined || state.outcome === undefined) return;
  const submission = await findSubmission(deps.env.DB, state.requestId);
  if (submission === null) {
    await conversation.deskReset(now);
    return void (await say(deps, actor.chatId, deskMessages.notFound));
  }

  const input: QuickDecisionInput = {
    requestId: state.requestId,
    chatId: submission.chatId,
    outcome: state.outcome,
    body: state.body ?? '',
    rejectUnderstood: state.rejectUnderstood,
    rejectWhyNot: state.rejectWhyNot,
    rejectWhenYes: state.rejectWhenYes,
    approvedBy: actor.displayName,
  };

  // ۱. اعتبارسنجی پیش از هر چیز — همان قیدهایی که هسته اعمال می‌کند.
  const composed = { ...input, body: composeResponseBody(input) };
  const verdict = validateQuickDecision(composed);
  if (!verdict.valid) {
    await conversation.deskReset(now);
    return void (await say(deps, actor.chatId, `❌ ${verdict.message}`));
  }

  // ۲. شماره و بادوام کردن — پیش از تحویل.
  const responseId = await issueResponseId(deps.env.DB);
  await persistDecision(deps.env.DB, responseId, composed, composed.body, now);
  await conversation.deskReset(now);

  // ۳. تحویل به ثبت‌کننده.
  const delivery = await deps.adapter.send({
    recipient: submission.chatId,
    text: composed.body,
  });

  if (!delivery.delivered) {
    return void (await say(
      deps,
      actor.chatId,
      deskMessages.deliveryFailed(state.requestId, delivery.reason),
    ));
  }

  // ۴. علامت تحویل.
  await markDeliveredToUser(deps.env.DB, responseId, now);
  await say(deps, actor.chatId, deskMessages.sent(state.requestId, responseId));
}

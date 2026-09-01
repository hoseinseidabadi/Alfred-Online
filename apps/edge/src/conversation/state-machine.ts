import type { RequestType, Unit } from '@alfred-online/contracts';
import {
  type Question,
  TYPE_QUESTION,
  UNIT_QUESTION,
  contentQuestions,
  isValidChoice,
} from './questions';

/**
 * ماشین حالت گفت‌وگو — FR-003، FR-005، FR-013، FR-014.
 *
 * گذارها:
 *   `idle → askUnit?* → askType → askQ1..Qn → askRoleQ → askAttachment → confirm → submitted`
 *   (`askUnit` فقط اگر `unit` خالی باشد — FR-003)
 *
 * **این ماژول تابع محض است و هیچ ورودی/خروجی‌ای ندارد.** حالت را می‌گیرد و
 * حالت بعدی را برمی‌گرداند. Durable Object فقط نگهدارندهٔ آن است (T036).
 *
 * چرا این تفکیک: آزمون الزامی ۴ (بقای گفت‌وگو، V-6) باید ثابت کند حالت پس از
 * بازراه‌اندازی دقیقاً از همان‌جا ادامه می‌یابد. اگر منطق گذار داخل شیء
 * پایدار قاطی می‌شد، تشخیص «حالت خراب شد» از «منطق خراب شد» ناممکن می‌بود.
 */

export type Step =
  | 'idle'
  | 'askUnit'
  | 'askType'
  | 'askContent'
  | 'askAttachment'
  | 'confirm'
  | 'submitted'
  | 'cancelled';

export interface Attachment {
  kind: 'photo' | 'document' | 'link';
  ref: string;
}

export interface ConversationState {
  step: Step;
  /** یک بار پرسیده، برای همیشه ماندگار — حتی پس از پایان گفت‌وگو (FR-003). */
  unit?: Unit;
  requestType?: RequestType;
  /** پاسخ‌های جمع‌آوری‌شده تا این لحظه، عین متن (اصل II). */
  answers: Record<string, string>;
  attachments: Attachment[];
  /** شاخص پرسش محتوایی جاری. */
  contentIndex: number;
  startedAt: number;
  lastActivityAt: number;
}

/** بی‌فعالیتی بیش از این، گفت‌وگو را منقضی می‌کند — FR-013. */
export const CONVERSATION_TTL_MS = 24 * 60 * 60 * 1000;

export function initialState(unit?: Unit, now = Date.now()): ConversationState {
  return {
    step: 'idle',
    unit,
    answers: {},
    attachments: [],
    contentIndex: 0,
    startedAt: now,
    lastActivityAt: now,
  };
}

/** آیا گفت‌وگو به‌خاطر بی‌فعالیتی منقضی شده — FR-013. */
export function isExpired(state: ConversationState, now = Date.now()): boolean {
  return now - state.lastActivityAt > CONVERSATION_TTL_MS;
}

/** آیا گفت‌وگویی در جریان است که شروع ثبت تازه آن را از بین می‌برد. */
export function isInProgress(state: ConversationState): boolean {
  return state.step !== 'idle' && state.step !== 'submitted' && state.step !== 'cancelled';
}

/**
 * پرسشی که همین حالا باید مطرح شود، یا `null` اگر پرسشی نمانده.
 *
 * تنها منبع حقیقتِ «کجای گفت‌وگوییم». بازراه‌اندازی سرویس این را عوض نمی‌کند،
 * چون فقط از `state` می‌خواند.
 */
export function currentQuestion(state: ConversationState): Question | null {
  switch (state.step) {
    case 'askUnit':
      return UNIT_QUESTION;
    case 'askType':
      return TYPE_QUESTION;
    case 'askContent': {
      if (state.unit === undefined || state.requestType === undefined) return null;
      const questions = contentQuestions(state.requestType, state.unit);
      return questions[state.contentIndex] ?? null;
    }
    default:
      return null;
  }
}

export type TransitionResult =
  | { ok: true; state: ConversationState }
  | {
      ok: false;
      reason: 'invalid_choice' | 'empty_answer' | 'not_asking';
      state: ConversationState;
    };

/** گفت‌وگو را شروع یا از سر می‌گیرد. */
export function start(state: ConversationState, now = Date.now()): ConversationState {
  return {
    ...initialState(state.unit, now),
    // واحد سازمانی از گفت‌وگوی قبلی می‌ماند — FR-003.
    step: state.unit === undefined ? 'askUnit' : 'askType',
  };
}

/**
 * پاسخ کاربر را می‌پذیرد و به گام بعد می‌رود.
 *
 * پاسخ نامعتبر حالت را **جلو نمی‌برد** و همان پرسش دوباره مطرح می‌شود —
 * به‌جای اینکه بی‌صدا مقدار غلط ذخیره شود.
 */
export function answer(state: ConversationState, raw: string, now = Date.now()): TransitionResult {
  const question = currentQuestion(state);
  if (question === null) return { ok: false, reason: 'not_asking', state };

  const value = raw.trim();
  if (value.length === 0) return { ok: false, reason: 'empty_answer', state };
  if (!isValidChoice(question, value)) return { ok: false, reason: 'invalid_choice', state };

  const next: ConversationState = { ...state, lastActivityAt: now };

  switch (state.step) {
    case 'askUnit':
      next.unit = value as Unit;
      next.step = 'askType';
      return { ok: true, state: next };

    case 'askType':
      next.requestType = value as RequestType;
      next.step = 'askContent';
      next.contentIndex = 0;
      return { ok: true, state: next };

    case 'askContent': {
      next.answers = { ...state.answers, [question.key]: value };
      next.contentIndex = state.contentIndex + 1;
      const remaining = currentQuestion(next);
      if (remaining === null) next.step = 'askAttachment';
      return { ok: true, state: next };
    }

    default:
      return { ok: false, reason: 'not_asking', state };
  }
}

/** پیوست اختیاری اضافه می‌کند — FR-011. */
export function addAttachment(
  state: ConversationState,
  attachment: Attachment,
  now = Date.now(),
): ConversationState {
  return {
    ...state,
    attachments: [...state.attachments, attachment],
    lastActivityAt: now,
  };
}

/** از گام پیوست به تأیید نهایی می‌رود. */
export function skipAttachments(state: ConversationState, now = Date.now()): ConversationState {
  return { ...state, step: 'confirm', lastActivityAt: now };
}

/**
 * ثبت را نهایی می‌کند و **حالت را پاک می‌کند**.
 *
 * پاک کردن حیاتی است: نسخهٔ اول پاسخ‌ها را نگه می‌داشت، پس `isComplete` پس از
 * ثبت هم `true` می‌ماند و یک «تمام» تصادفی همان پاسخ‌ها را دوباره ثبت می‌کرد.
 * کاربر در تست واقعی دقیقاً همین را دید: یک درخواست بی‌ربط با محتوای ثبت قبلی.
 *
 * واحد سازمانی می‌ماند — از عمر گفت‌وگو بلندتر است (FR-003).
 */
export function confirm(state: ConversationState, now = Date.now()): ConversationState {
  return { ...initialState(state.unit, now), step: 'submitted' };
}

/**
 * آیا گفت‌وگو در گام پیوست است.
 *
 * تنها حالتی که «تمام» معنا دارد. بدون این بررسی، «تمام» در هر لحظه‌ای ثبت را
 * تمام‌شده اعلام می‌کرد.
 */
export function isAwaitingAttachment(state: ConversationState): boolean {
  return state.step === 'askAttachment';
}

/** گفت‌وگو را بدون ثبت پایان می‌دهد — سناریوی پذیرش ۷ در US1. */
export function cancel(state: ConversationState, now = Date.now()): ConversationState {
  return { ...initialState(state.unit, now), step: 'cancelled' };
}

/**
 * آیا همهٔ پرسش‌های محتوایی جواب داده شده‌اند.
 * پیش از ثبت بررسی می‌شود تا ثبت ناقص به هسته نرود.
 */
export function isComplete(state: ConversationState): boolean {
  if (state.unit === undefined || state.requestType === undefined) return false;
  const questions = contentQuestions(state.requestType, state.unit);
  return questions
    .filter((q) => q.optional !== true)
    .every((q) => (state.answers[q.key] ?? '').length > 0);
}

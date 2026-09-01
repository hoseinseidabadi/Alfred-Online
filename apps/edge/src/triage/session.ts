import type { TriageOutcome } from '@alfred-online/contracts';

/**
 * حالت گفت‌وگوی **میز تریاژ** — جدا از حالت ثبت.
 *
 * چرا جدا: مدیر محصول هم ثبت‌کننده است. اگر یک حالت مشترک بود، پاسخ دادن به
 * یک خرابی وسط ثبتِ خودش، آن ثبت را نابود می‌کرد. دو کلید جدا در همان شیء
 * گفت‌وگو، این را ناممکن می‌کند.
 */

export type DeskStep =
  'idle' | 'chooseOutcome' | 'askBody' | 'askUnderstood' | 'askWhyNot' | 'askWhenYes';

export interface DeskState {
  step: DeskStep;
  requestId?: string;
  outcome?: TriageOutcome;
  body?: string;
  rejectUnderstood?: string;
  rejectWhyNot?: string;
  rejectWhenYes?: string;
  startedAt: number;
}

export const idleDesk = (now = Date.now()): DeskState => ({ step: 'idle', startedAt: now });

/** پاسخ دادن به یک درخواست شروع می‌شود. */
export const beginReply = (requestId: string, now = Date.now()): DeskState => ({
  step: 'chooseOutcome',
  requestId,
  startedAt: now,
});

/**
 * سرنوشت انتخاب شد — گام بعد به نوعش بستگی دارد.
 *
 * «رد» سه پرسش جدا می‌گیرد، بقیه یک متن. این تفاوت عمدی است: اگر رد هم یک
 * متن آزاد بود، FR-031 عملاً اختیاری می‌شد و مسیر سریع به سوراخ اصل IV
 * تبدیل می‌گشت.
 */
export function withOutcome(state: DeskState, outcome: TriageOutcome): DeskState {
  return {
    ...state,
    outcome,
    step: outcome === 'reject' ? 'askUnderstood' : 'askBody',
  };
}

/** یک پاسخ متنی را می‌گیرد و به گام بعد می‌رود. */
export function withText(state: DeskState, text: string): DeskState {
  const value = text.trim();
  switch (state.step) {
    case 'askBody':
      return { ...state, body: value, step: 'idle' };
    case 'askUnderstood':
      return { ...state, rejectUnderstood: value, step: 'askWhyNot' };
    case 'askWhyNot':
      return { ...state, rejectWhyNot: value, step: 'askWhenYes' };
    case 'askWhenYes':
      // با پر شدن سومی، متن نهایی از سه بخش ساخته می‌شود.
      return { ...state, rejectWhenYes: value, step: 'idle' };
    default:
      return state;
  }
}

/** آیا همهٔ چیزهای لازم جمع شده و می‌شود فرستاد. */
export function isReadyToSend(state: DeskState): boolean {
  if (state.step !== 'idle' || state.requestId === undefined || state.outcome === undefined) {
    return false;
  }
  return state.outcome === 'reject'
    ? [state.rejectUnderstood, state.rejectWhyNot, state.rejectWhenYes].every(
        (part) => (part ?? '').trim().length > 0,
      )
    : (state.body ?? '').trim().length > 0;
}

export const isDeskActive = (state: DeskState): boolean => state.step !== 'idle';

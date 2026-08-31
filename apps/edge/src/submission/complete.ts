import { addDays, formatJalaliDateTime } from '@alfred-online/jalali';
import type { RequestType, Unit } from '@alfred-online/contracts';
import type { Attachment } from '../conversation/state-machine';
import { counterStub } from '../counter/counter.do';
import type { Env } from '../env';
import { persistSubmission } from './store';

/**
 * کامل کردن ثبت — T041، اصل III، FR-015، FR-016.
 *
 * **این تابع قلب «لبه خودکفاست» است.** ترتیب کارهایش تصادفی نیست:
 *
 *   ۱. شماره از شمارندهٔ لبه صادر می‌شود — نه از هسته (R-03).
 *   ۲. رکورد در D1 می‌نشیند — **پیش از هر تماس با هسته**.
 *   ۳. تازه بعد، شماره به کاربر گفته می‌شود.
 *
 * اگر ۲ و ۳ جا عوض می‌کردند، یک قطعی در همان لحظه یعنی کاربر شماره‌ای دارد که
 * هیچ‌جا وجود ندارد. اگر ۱ به هسته وابسته بود، در قطعی اصلاً شماره‌ای صادر
 * نمی‌شد و کل تجربه می‌شکست.
 *
 * **هیچ‌جای این مسیر تماسی با هسته نیست.** تحویل کار Cron است (T043، T044).
 */

/** تعهد پاسخ — همان عددی که هسته هم با آن `responseDueAt` را حساب می‌کند. */
const RESPONSE_COMMITMENT_DAYS = 7;

export interface CompleteSubmissionInput {
  chatId: string;
  submitterName: string;
  unit: Unit;
  requestType: RequestType;
  rawAnswers: Record<string, string>;
  attachments: Attachment[];
  submittedAt?: number;
}

export interface CompletedSubmission {
  requestId: string;
  submittedAt: number;
  /** متن فارسیِ آمادهٔ ارسال به کاربر. */
  confirmationText: string;
}

/**
 * ثبت را تمام می‌کند و متن تأیید را برمی‌گرداند.
 *
 * متن را **ارسال نمی‌کند** — آن کار مصرف‌کننده است. این تفکیک باعث می‌شود
 * آزمون الزامی ۱ (V-4) بتواند بدون هیچ تلگرامی، بادوام شدن ثبت را بسنجد.
 */
export async function completeSubmission(
  env: Env,
  input: CompleteSubmissionInput,
): Promise<CompletedSubmission> {
  const submittedAt = input.submittedAt ?? Date.now();

  // ۱. شماره از لبه — بدون هیچ وابستگی به هسته.
  const requestId = await counterStub(env).issue();

  // ۲. بادوام کردن، پیش از هر چیز دیگر.
  await persistSubmission(env.DB, {
    requestId,
    chatId: input.chatId,
    submitterName: input.submitterName,
    unit: input.unit,
    requestType: input.requestType,
    rawAnswers: input.rawAnswers,
    attachments: input.attachments,
    submittedAt,
  });

  // ۳. حالا می‌شود به کاربر گفت.
  return {
    requestId,
    submittedAt,
    confirmationText: confirmationMessage(requestId, submittedAt),
  };
}

/**
 * پیام تأیید ثبت.
 *
 * مهلت به **تاریخ جلالی و ساعت تهران** نمایش داده می‌شود — بند «زبان، تقویم و
 * لحن» قانون اساسی. شمارهٔ پیگیری عمداً لاتین می‌ماند: آدم‌ها آن را در جلسه
 * به زبان می‌آورند و در جست‌وجو تایپش می‌کنند.
 */
export function confirmationMessage(requestId: string, submittedAt: number): string {
  const dueAt = addDays(new Date(submittedAt), RESPONSE_COMMITMENT_DAYS);
  return [
    `ثبت شد ✅`,
    ``,
    `شمارهٔ پیگیری: ${requestId}`,
    `حداکثر تا ${formatJalaliDateTime(dueAt)} پاسخ مکتوب می‌گیری.`,
    ``,
    `برای دیدن وضعیت، همین شماره را بفرست.`,
  ].join('\n');
}

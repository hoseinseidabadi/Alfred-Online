import { addDays, formatJalaliDateTime, toPersianDigits } from '@alfred-online/jalali';
import type { Env } from '../env';
import { findSubmission } from './store';

/**
 * استعلام وضعیت با شمارهٔ پیگیری — FR-035.
 *
 * **چرا لبه خودش جواب می‌دهد و منتظر هسته نمی‌ماند** (اصل III): همان دلیلی که
 * شماره در لبه صادر می‌شود. اگر این پرسش به هسته وابسته بود، در قطعی کاربر
 * می‌شنید «شماره‌ات را پیدا نکردم» — بدترین چیزی که می‌شود به کسی گفت که
 * شمارهٔ پیگیری در دست دارد.
 *
 * آنچه لبه می‌داند: ثبت رسیده، کِی، و مهلت پاسخش کِی است.
 * آنچه نمی‌داند: سرنوشت تریاژ و متن پاسخ. آن‌ها با فاز ۴ (T067) از هسته
 * می‌آیند و به این پاسخ افزوده می‌شوند.
 */

const RESPONSE_COMMITMENT_DAYS = 7;

/**
 * وضعیت را به فارسی برمی‌گرداند، یا `null` اگر شماره برای این کاربر نباشد.
 *
 * تطبیق `chatId` عمدی است: شمارهٔ پیگیری قابل حدس زدن است (`REQ-1`، `REQ-2`)،
 * و بدون این بررسی هر کسی می‌توانست محتوای ثبت دیگران را ببیند.
 */
export async function describeStatus(
  env: Env,
  requestId: string,
  chatId: string,
  now: number = Date.now(),
): Promise<string | null> {
  const submission = await findSubmission(env.DB, requestId);
  if (submission === null || submission.chatId !== chatId) return null;

  const dueAt = addDays(new Date(submission.submittedAt), RESPONSE_COMMITMENT_DAYS);
  const daysLeft = Math.floor((dueAt.getTime() - now) / 86_400_000);

  const lines = [
    `${requestId} — ثبت شده ✅`,
    '',
    `زمان ثبت: ${formatJalaliDateTime(new Date(submission.submittedAt))}`,
    `مهلت پاسخ: ${formatJalaliDateTime(dueAt)}`,
  ];

  if (daysLeft > 0) {
    lines.push(`${toPersianDigits(daysLeft)} روز تا مهلت مانده.`);
  } else if (daysLeft === 0) {
    lines.push('مهلت پاسخ امروز است.');
  } else {
    // صادق بودن اینجا مهم‌تر از خوب به‌نظر رسیدن است — تعهد نقض شده و
    // ثبت‌کننده حق دارد بداند.
    lines.push('از مهلت گذشته است. واحد محصول باید پاسخ بدهد.');
  }

  lines.push('', 'به‌محض آماده شدن پاسخ، همین‌جا برایت می‌فرستم.');
  return lines.join('\n');
}

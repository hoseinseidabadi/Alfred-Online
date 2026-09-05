import type { Env } from '../env';
import { drainDecisions } from './decisions-outbox';
import { drainOutbox, reportPendingStats } from './outbox';

/**
 * چرخهٔ پل — T044، R-04.
 *
 * هر اجرا سه کار می‌کند و **ترتیبشان مهم است**:
 *   ۱. ثبت‌های معطل را به هسته می‌فرستد (T043)
 *   ۲. تصمیم‌های میز تلگرامی را می‌فرستد
 *   ۳. پاسخ‌های آماده را می‌کشد و تحویل می‌دهد (T065، فاز ۴)
 *
 * چرا این ترتیب: تصمیم برای درخواستی که هسته هنوز ندیده‌اش رد می‌شود. فرستادن
 * ثبت‌ها **اول**، این را در همان چرخه حل می‌کند به‌جای اینکه یک دور عقب بیفتد.
 *
 * فاصلهٔ اجرا در `wrangler.toml` است و مقدارش خروجی spike S-2 (T002) خواهد
 * بود. فعلاً پیش‌فرض R-04 — هر دو دقیقه.
 */

export interface CycleResult {
  submissionsDelivered: number;
  submissionsFailed: number;
  decisionsDelivered: number;
  error: string | null;
}

/**
 * یک چرخهٔ کامل.
 *
 * مثل `drainOutbox` هرگز پرتاب نمی‌کند: شکست تماس واقعیتِ عادیِ یک پل
 * ناپایدار است، و پرتاب یعنی کار دوم چرخه هم انجام نشود.
 */
export async function runBridgeCycle(env: Env, now: number = Date.now()): Promise<CycleResult> {
  const drain = await drainOutbox(env, now);

  // پس از ثبت‌ها، تا تصمیم برای درخواستِ نرسیده رد نشود.
  const decisions = await drainDecisions(env, now);

  // T065 (فاز ۴): کشیدن پاسخ‌ها از `GET /bridge/outbound` و تحویلشان.

  await reportPendingStats(
    env,
    drain.error === null ? now : null,
    drain.error,
    // تعداد پاسخ‌های معطل — تا فاز ۴ همیشه صفر است.
    0,
  );

  return {
    submissionsDelivered: drain.delivered.length,
    submissionsFailed: drain.rejected.length,
    decisionsDelivered: decisions.delivered.length,
    error: drain.error ?? decisions.error,
  };
}

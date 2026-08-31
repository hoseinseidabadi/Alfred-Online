import {
  BRIDGE_KEY_HEADER,
  type BridgePendingStats,
  type BridgeSubmissionsResponse,
} from '@alfred-online/contracts';
import type { Env } from '../env';
import {
  markDelivered,
  pendingCount,
  pendingSubmissions,
  recordFailure,
  toBridgePayload,
} from '../submission/store';

/**
 * صف خروجی: ثبت‌های معطل را به هسته می‌رساند — T043، R-04، FR-017.
 *
 * **کشش‌محور از سمت لبه** (اصل III): هسته هرگز تماس خروجی نمی‌گیرد. مزیت
 * تعیین‌کننده‌اش این است که ضعیف‌ترین مسیر — از داخل ایران به خارج — اصلاً
 * استفاده نمی‌شود.
 *
 * سه ضمانت که این ماژول باید بدهد:
 *   **ترتیب** — قدیمی‌ترین اول (FR-017، آزمون الزامی ۳)
 *   **بدون گم‌شدن** — رکورد فقط پس از تأیید هسته علامت می‌خورد
 *   **بدون تکرار** — کلید idempotency همان شمارهٔ پیگیری است
 */

/** بیشینهٔ اقلام در هر چرخه. قطعیِ طولانی چند چرخه طول می‌کشد، نه یک تماس غول. */
export const DRAIN_BATCH_SIZE = 50;

export interface DrainResult {
  attempted: number;
  delivered: string[];
  rejected: string[];
  /** `null` یعنی تماس موفق بود. */
  error: string | null;
}

/**
 * یک دور تخلیهٔ صف.
 *
 * **هیچ‌وقت پرتاب نمی‌کند.** شکست تماس یک واقعیت عادی است، نه استثنا: پل
 * ناپایدار فرض شده. پرتاب کردن یعنی چرخهٔ Cron نیمه‌کاره بماند و کار دوم
 * (تحویل پاسخ‌ها) هم انجام نشود.
 */
export async function drainOutbox(env: Env, now: number = Date.now()): Promise<DrainResult> {
  const pending = await pendingSubmissions(env.DB, DRAIN_BATCH_SIZE);
  if (pending.length === 0) {
    return { attempted: 0, delivered: [], rejected: [], error: null };
  }

  const ids = pending.map((submission) => submission.requestId);

  let response: Response;
  try {
    response = await fetch(`${env.CORE_URL}/bridge/submissions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [BRIDGE_KEY_HEADER]: env.BRIDGE_KEY,
      },
      body: JSON.stringify({ submissions: pending.map(toBridgePayload) }),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    await recordFailure(env.DB, ids, reason);
    return { attempted: pending.length, delivered: [], rejected: [], error: reason };
  }

  if (!response.ok) {
    const reason = `HTTP ${response.status}`;
    await recordFailure(env.DB, ids, reason);
    return { attempted: pending.length, delivered: [], rejected: [], error: reason };
  }

  let body: BridgeSubmissionsResponse;
  try {
    body = (await response.json()) as BridgeSubmissionsResponse;
  } catch (error) {
    const reason = `پاسخ نامعتبر: ${error instanceof Error ? error.message : String(error)}`;
    await recordFailure(env.DB, ids, reason);
    return { attempted: pending.length, delivered: [], rejected: [], error: reason };
  }

  const accepted = body.accepted ?? [];
  const rejected = body.rejected ?? [];

  // فقط پذیرفته‌شده‌ها علامت می‌خورند. رد‌شده‌ها در صف می‌مانند تا آدمی
  // ببیندشان — **حذف نمی‌شوند** (ناوردای ۹).
  await markDelivered(env.DB, accepted, now);
  if (rejected.length > 0) {
    await recordFailure(
      env.DB,
      rejected.map((item) => item.requestId),
      rejected.map((item) => `${item.requestId}: ${item.reason}`).join(' · '),
    );
  }

  return {
    attempted: pending.length,
    delivered: accepted,
    rejected: rejected.map((item) => item.requestId),
    error: null,
  };
}

/**
 * آمار معطل‌ها را به هسته گزارش می‌کند — FR-019.
 *
 * شکستش بی‌اهمیت است و بلعیده می‌شود: این فقط برای نمایش است و نباید چرخهٔ
 * تحویل را خراب کند.
 */
export async function reportPendingStats(
  env: Env,
  lastSuccessfulContactAt: number | null,
  lastError: string | null,
  pendingDeliveries: number,
): Promise<void> {
  const stats: BridgePendingStats = {
    pendingSubmissions: await pendingCount(env.DB),
    pendingDeliveries,
    lastSuccessfulContactAt:
      lastSuccessfulContactAt === null ? null : new Date(lastSuccessfulContactAt).toISOString(),
    lastError,
  };

  try {
    await fetch(`${env.CORE_URL}/bridge/health/stats`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [BRIDGE_KEY_HEADER]: env.BRIDGE_KEY,
      },
      body: JSON.stringify(stats),
    });
  } catch {
    // عمداً بلعیده می‌شود — گزارش آمار نباید تحویل را زمین بزند.
  }
}

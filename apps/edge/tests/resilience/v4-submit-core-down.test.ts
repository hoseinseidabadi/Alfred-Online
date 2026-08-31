import { applyD1Migrations, env, runInDurableObject } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, inject, it, vi } from 'vitest';
import type { CounterDO } from '../../src/counter/counter.do';
import { completeSubmission } from '../../src/submission/complete';
import { findSubmission, pendingCount, pendingSubmissions } from '../../src/submission/store';

/**
 * ✅ آزمون الزامی ۱ — **تکمیل ثبت با هستهٔ در دسترس نبودن**
 *
 * قانون اساسی، بند «تاب‌آوری و آزمون»، مورد اول:
 *   «یک ثبت به‌طور کامل انجام می‌شود در حالی که منبع حقیقت عملیاتی در دسترس
 *    نیست.»
 *
 * سناریوی متناظر: **V-4** در `quickstart.md`
 *   «هسته را متوقف کن → یک ثبت کامل انجام بده → انتظار: شماره صادر می‌شود و
 *    کاربر **هیچ تفاوتی** حس نمی‌کند؛ رکورد در D1 با
 *    `deliveredToCoreAt = null`.»
 *
 * راهبرد از R-12: آزمون یکپارچه روی زمان اجرای Workers با هستهٔ ساختگیِ خطاده.
 *
 * **این آزمون اصل III را می‌سنجد** — «لبه خودکفاست». اگر بشکند، کل دلیل
 * وجودی معماری دو-محیطی از بین می‌رود.
 */

/**
 * هر تماس شبکه‌ای را به شکست تبدیل می‌کند — انگار هسته اصلاً وصل نمی‌شود.
 *
 * روی `fetch` **سراسری** می‌نشیند، نه یک تابع محلی. تفاوتش تعیین‌کننده است:
 * جاسوسی که به چیزی وصل نباشد، ادعای «صدا زده نشد» را بی‌محتوا می‌کند. این
 * یکی هر مسیر خروجیِ ممکن را می‌گیرد، پس اگر روزی کسی تماسی با هسته به این
 * مسیر اضافه کند، آزمون **می‌شکند** — که دقیقاً کار آزمون الزامی ۱ است.
 */
const killAllNetwork = () =>
  vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
    throw new Error('connect ECONNREFUSED — هسته خاموش است');
  });

const SAMPLE = {
  chatId: '265966801',
  submitterName: 'حسین',
  unit: 'editorial' as const,
  requestType: 'bug' as const,
  rawAnswers: {
    where: 'وب‌سایت',
    action: 'صفحهٔ خبر رو باز کردم، ساعت شلوغی عصر',
    observed: 'خطای ۵۰۲ داد؛ انتظار داشتم خبر باز شود',
    since: 'this_week',
    scope: 'few_people',
    roleQuestion: 'خواننده اصلاً صفحه را نمی‌بیند',
  },
  attachments: [],
};

describe('✅ آزمون الزامی ۱ — ثبت با هستهٔ در دسترس نبودن (V-4)', () => {
  beforeEach(async () => {
    await applyD1Migrations(env.DB, inject('d1Migrations'));
    await env.DB.prepare('DELETE FROM edge_submission').run();
    await runInDurableObject(
      env.COUNTER.get(env.COUNTER.idFromName('global')) as DurableObjectStub<CounterDO>,
      async (_i, state) => {
        await state.storage.deleteAll();
      },
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('سناریوی V-4 — شماره صادر می‌شود حتی وقتی هیچ شبکه‌ای نیست', async () => {
    const network = killAllNetwork();

    const result = await completeSubmission(env, SAMPLE);

    expect(result.requestId).toBe('REQ-1');
    // مسیر ثبت **هیچ** تماس خروجی نمی‌گیرد. اصل III در یک ادعا.
    expect(network).not.toHaveBeenCalled();
  });

  it('حتی اگر شبکه پرتاب کند، ثبت کامل می‌شود', async () => {
    // ادعای بالا اثبات می‌کند تماسی گرفته نشد؛ این یکی اثبات می‌کند حتی اگر
    // مسیری از قلم افتاده باشد، شکستِ آن ثبت را زمین نمی‌زند.
    killAllNetwork();
    await expect(completeSubmission(env, SAMPLE)).resolves.toMatchObject({
      requestId: 'REQ-1',
    });
  });

  it('رکورد در D1 با deliveredToCoreAt = null می‌ماند', async () => {
    const { requestId } = await completeSubmission(env, SAMPLE);

    const stored = await findSubmission(env.DB, requestId);
    expect(stored).not.toBeNull();
    expect(stored?.deliveredToCoreAt).toBeNull();
    expect(stored?.deliveryAttempts).toBe(0);
  });

  it('پاسخ‌های خام فارسی عیناً بادوام می‌شوند — اصل II', async () => {
    const { requestId } = await completeSubmission(env, SAMPLE);
    const stored = await findSubmission(env.DB, requestId);
    expect(stored?.rawAnswers).toEqual(SAMPLE.rawAnswers);
  });

  it('کاربر هیچ تفاوتی حس نمی‌کند — پیام تأیید کامل است', async () => {
    const { requestId, confirmationText } = await completeSubmission(env, SAMPLE);

    expect(confirmationText).toContain(requestId);
    expect(confirmationText).toContain('ثبت شد');
    // مهلت هفت‌روزه، به تاریخ جلالی — نه میلادی، نه «بعداً خبر می‌دهیم».
    expect(confirmationText).toMatch(/[۰-۹]{4}\/[۰-۹]{2}\/[۰-۹]{2}/);
    expect(confirmationText).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it('چند ثبت پشت‌سرهم با هستهٔ خاموش، همه بادوام و به‌ترتیب', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      const { requestId } = await completeSubmission(env, {
        ...SAMPLE,
        submittedAt: Date.UTC(2026, 7, 24, 6, i),
      });
      ids.push(requestId);
    }

    expect(ids).toEqual(['REQ-1', 'REQ-2', 'REQ-3', 'REQ-4', 'REQ-5']);
    expect(await pendingCount(env.DB)).toBe(5);

    // صف به‌ترتیب زمانی بیرون می‌آید — پیش‌نیاز آزمون الزامی ۳.
    const pending = await pendingSubmissions(env.DB);
    expect(pending.map((p) => p.requestId)).toEqual(ids);
  });

  it('تلاش دوبارهٔ ثبت با همان شماره رکورد تکراری نمی‌سازد', async () => {
    const { requestId } = await completeSubmission(env, SAMPLE);
    const before = await pendingCount(env.DB);

    // همان شماره دوباره — idempotency روی کلید اصلی.
    const { persistSubmission } = await import('../../src/submission/store');
    await persistSubmission(env.DB, {
      ...SAMPLE,
      requestId,
      submittedAt: Date.now(),
    });

    expect(await pendingCount(env.DB)).toBe(before);
  });
});

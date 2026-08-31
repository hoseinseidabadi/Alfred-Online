import { applyD1Migrations, env, runInDurableObject } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, inject, it, vi } from 'vitest';
import { drainOutbox } from '../../src/bridge/outbox';
import type { CounterDO } from '../../src/counter/counter.do';
import { completeSubmission } from '../../src/submission/complete';
import { pendingCount, pendingSubmissions } from '../../src/submission/store';
import { FakeCore } from '../helpers/fake-core';

/**
 * ✅ آزمون الزامی ۳ — **تحویل صف پس از بازگشت ارتباط**
 *
 * قانون اساسی، بند «تاب‌آوری و آزمون»، مورد سوم:
 *   «اقلام صف‌شده در هر دو جهت پس از بازگشت ارتباط تحویل می‌شوند — به‌ترتیب
 *    زمانی، با صفر گم‌شدگی.»
 *
 * سناریوی متناظر: **V-5** در `quickstart.md`
 *   «با هستهٔ خاموش، سه ثبت انجام بده → هسته را روشن کن و منتظر یک چرخهٔ Cron
 *    بمان → انتظار: هر سه، **به‌ترتیب زمانی** و بدون تکرار. اجرای دوبارهٔ
 *    Cron → هیچ رکورد تکراری.»
 *
 * راهبرد از R-12: آزمون سناریویی — قطعی → N ثبت → وصل → بررسی ترتیب و کامل
 * بودن.
 */

const SAMPLE = {
  chatId: '265966801',
  submitterName: 'حسین',
  unit: 'editorial' as const,
  requestType: 'bug' as const,
  rawAnswers: { where: 'وب‌سایت', observed: 'خطای ۵۰۲ داد' },
  attachments: [],
};

describe('✅ آزمون الزامی ۳ — تحویل صف پس از بازگشت ارتباط (V-5)', () => {
  let core: FakeCore;

  beforeEach(async () => {
    await applyD1Migrations(env.DB, inject('d1Migrations'));
    await env.DB.prepare('DELETE FROM edge_submission').run();
    await runInDurableObject(
      env.COUNTER.get(env.COUNTER.idFromName('global')) as DurableObjectStub<CounterDO>,
      async (_i, state) => {
        await state.storage.deleteAll();
      },
    );
    core = new FakeCore();
    core.install();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** N ثبت با فاصلهٔ یک دقیقه، به‌ترتیب زمانی. */
  const submitDuringOutage = async (count: number): Promise<string[]> => {
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      const { requestId } = await completeSubmission(env, {
        ...SAMPLE,
        submittedAt: Date.UTC(2026, 7, 24, 6, i),
      });
      ids.push(requestId);
    }
    return ids;
  };

  it('سناریوی V-5 — سه ثبت در قطعی، سپس یک چرخه پس از بازگشت', async () => {
    core.stop();
    const ids = await submitDuringOutage(3);

    // در قطعی، تخلیه تلاش می‌کند و شکست می‌خورد — ولی چیزی گم نمی‌شود.
    const duringOutage = await drainOutbox(env);
    expect(duringOutage.error).not.toBeNull();
    expect(duringOutage.delivered).toEqual([]);
    expect(await pendingCount(env.DB)).toBe(3);

    core.start();
    const afterReturn = await drainOutbox(env);

    expect(afterReturn.error).toBeNull();
    expect(afterReturn.delivered).toEqual(ids);
    // **به‌ترتیب زمانی** — قدیمی‌ترین اول.
    expect(core.receivedIds).toEqual(['REQ-1', 'REQ-2', 'REQ-3']);
    expect(await pendingCount(env.DB)).toBe(0);
  });

  it('اجرای دوبارهٔ Cron هیچ رکورد تکراری نمی‌سازد', async () => {
    core.stop();
    await submitDuringOutage(3);
    core.start();

    await drainOutbox(env);
    const secondRun = await drainOutbox(env);

    // بار دوم چیزی برای فرستادن نیست.
    expect(secondRun.attempted).toBe(0);
    expect(core.receivedIds).toEqual(['REQ-1', 'REQ-2', 'REQ-3']);
  });

  it('حتی اگر همان بسته دوباره فرستاده شود، هسته تکراری نمی‌سازد', async () => {
    core.stop();
    await submitDuringOutage(2);
    core.start();

    // شبیه‌سازی تلاش دوباره پس از پاسخی که در راه گم شد: بسته دوباره می‌رود.
    await drainOutbox(env);
    await env.DB.prepare('UPDATE edge_submission SET delivered_to_core_at = NULL').run();
    await drainOutbox(env);

    expect(core.calls).toHaveLength(2);
    // دو بار فرستاده شد، ولی هسته دو رکورد نساخت — idempotency روی شماره.
    expect(core.receivedIds).toEqual(['REQ-1', 'REQ-2']);
  });

  it('تلاش ناموفق شمرده می‌شود و علتش می‌ماند — FR-019', async () => {
    core.stop();
    await submitDuringOutage(1);

    await drainOutbox(env);
    await drainOutbox(env);

    const [pending] = await pendingSubmissions(env.DB);
    expect(pending?.deliveryAttempts).toBe(2);
    expect(pending?.lastError).toContain('ECONNREFUSED');
  });

  it('پس از تحویل موفق، خطای قبلی پاک می‌شود', async () => {
    core.stop();
    await submitDuringOutage(1);
    await drainOutbox(env);

    core.start();
    await drainOutbox(env);

    const stored = await env.DB.prepare(
      'SELECT last_error, delivered_to_core_at FROM edge_submission WHERE request_id = ?',
    )
      .bind('REQ-1')
      .first<{ last_error: string | null; delivered_to_core_at: number | null }>();

    expect(stored?.last_error).toBeNull();
    expect(stored?.delivered_to_core_at).not.toBeNull();
  });

  it('قطعی طولانی چند چرخه‌ای، ترتیب را حفظ می‌کند', async () => {
    core.stop();
    await submitDuringOutage(5);

    // چند چرخهٔ ناموفق پشت‌سرهم.
    for (let i = 0; i < 4; i++) await drainOutbox(env);
    expect(await pendingCount(env.DB)).toBe(5);

    core.start();
    await drainOutbox(env);

    expect(core.receivedIds).toEqual(['REQ-1', 'REQ-2', 'REQ-3', 'REQ-4', 'REQ-5']);
  });

  it('تخلیه هرگز پرتاب نمی‌کند — چرخهٔ Cron باید تا آخر برود', async () => {
    // اگر پرتاب می‌کرد، کار دوم چرخه (تحویل پاسخ‌ها) هم انجام نمی‌شد.
    core.stop();
    await submitDuringOutage(1);
    await expect(drainOutbox(env)).resolves.toMatchObject({ error: expect.any(String) });
  });
});

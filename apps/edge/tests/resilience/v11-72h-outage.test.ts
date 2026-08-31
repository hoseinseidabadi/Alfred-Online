import { applyD1Migrations, env, runInDurableObject } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, inject, it, vi } from 'vitest';
import { DRAIN_BATCH_SIZE, drainOutbox } from '../../src/bridge/outbox';
import type { CounterDO } from '../../src/counter/counter.do';
import { completeSubmission } from '../../src/submission/complete';
import { pendingCount } from '../../src/submission/store';
import { FakeCore } from '../helpers/fake-core';

/**
 * ✅ **SC-004** — قطعی ۷۲ ساعته، صفر ثبت گم‌شده
 *
 * معیار موفقیت SC-004:
 *   «در قطعی کامل ارتباط بین لایهٔ پیام‌رسان و منبع حقیقت عملیاتی تا ۷۲ ساعت،
 *    صفر ثبت از دست می‌رود و ثبت‌کننده هیچ تفاوتی در تجربه‌اش حس نمی‌کند.»
 *
 * سناریوی متناظر: **V-11** در `quickstart.md`
 *   «با زمان جهش‌داده‌شده: ۷۲ ساعت قطعی، N ثبت در طول آن، سپس اتصال. انتظار:
 *    `N` ثبت رسیده، صفر گم‌شده، ترتیب حفظ‌شده، صفر تکراری.»
 *
 * `quickstart.md` صریح است که این **آزمون اجراشدنی** می‌خواهد، نه بررسی دستی.
 * R-12 هم همین را گفت: «آزمون دستی قطعی — رد شد.»
 *
 * زمان جهش داده می‌شود نه سپری: `submittedAt` صریحاً پاس داده می‌شود، پس
 * ۷۲ ساعت در چند میلی‌ثانیه شبیه‌سازی می‌گردد.
 */

const OUTAGE_HOURS = 72;
/** حجم واقعی: ۳۰ تا ۵۰ ثبت در ماه، پس ۷۲ ساعت یعنی چند تا. عدد سخاوتمندانه. */
const SUBMISSIONS_DURING_OUTAGE = 12;

const OUTAGE_START = Date.UTC(2026, 7, 24, 6, 0, 0);
const HOUR_MS = 3_600_000;

const SAMPLE = {
  chatId: '265966801',
  submitterName: 'حسین',
  unit: 'editorial' as const,
  requestType: 'bug' as const,
  attachments: [],
};

describe('✅ SC-004 — قطعی ۷۲ ساعته، صفر گم‌شدگی (V-11)', () => {
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

  /**
   * ۷۲ ساعت قطعی را شبیه‌سازی می‌کند: ثبت‌ها در طول آن پخش می‌شوند و چرخه‌های
   * Cron هم مثل واقعیت مرتب اجرا می‌شوند و هر بار شکست می‌خورند.
   */
  const runOutage = async (): Promise<string[]> => {
    core.stop();
    const ids: string[] = [];
    const spacing = (OUTAGE_HOURS * HOUR_MS) / SUBMISSIONS_DURING_OUTAGE;

    for (let i = 0; i < SUBMISSIONS_DURING_OUTAGE; i++) {
      const { requestId } = await completeSubmission(env, {
        ...SAMPLE,
        rawAnswers: { where: 'وب‌سایت', observed: `خرابی شمارهٔ ${i + 1}` },
        submittedAt: OUTAGE_START + Math.round(i * spacing),
      });
      ids.push(requestId);
      // هر ثبت، یک چرخهٔ Cron که شکست می‌خورد.
      await drainOutbox(env);
    }
    return ids;
  };

  it('در طول ۷۲ ساعت قطعی، هر ثبت شماره می‌گیرد و بادوام می‌شود', async () => {
    const ids = await runOutage();

    expect(ids).toHaveLength(SUBMISSIONS_DURING_OUTAGE);
    expect(new Set(ids).size).toBe(SUBMISSIONS_DURING_OUTAGE);
    expect(await pendingCount(env.DB)).toBe(SUBMISSIONS_DURING_OUTAGE);
    // هیچ‌کدام به هسته نرسیده — قطعی واقعاً کامل بوده.
    expect(core.receivedIds).toEqual([]);
  });

  it('سناریوی V-11 — پس از اتصال: N رسیده، صفر گم‌شده، ترتیب حفظ، صفر تکراری', async () => {
    const ids = await runOutage();

    core.start();
    await drainOutbox(env);

    // ۱. N رسیده
    expect(core.received).toHaveLength(SUBMISSIONS_DURING_OUTAGE);
    // ۲. صفر گم‌شده
    expect(await pendingCount(env.DB)).toBe(0);
    // ۳. ترتیب حفظ‌شده — دقیقاً به‌ترتیب زمان ثبت
    expect(core.receivedIds).toEqual(ids);
    // ۴. صفر تکراری
    expect(new Set(core.receivedIds).size).toBe(SUBMISSIONS_DURING_OUTAGE);
  });

  it('محتوای هر ثبت پس از ۷۲ ساعت دست‌نخورده می‌رسد — اصل II', async () => {
    await runOutage();
    core.start();
    await drainOutbox(env);

    core.received.forEach((submission, index) => {
      expect(submission.rawAnswers).toEqual({
        where: 'وب‌سایت',
        observed: `خرابی شمارهٔ ${index + 1}`,
      });
    });
  });

  it('زمان ثبت هر قلم همان لحظهٔ قطعی است، نه لحظهٔ تحویل', async () => {
    await runOutage();
    core.start();
    await drainOutbox(env);

    const timestamps = core.received.map((s) => new Date(s.submittedAt).getTime());
    // اکیداً صعودی — ترتیب زمانی واقعی، نه ترتیب تحویل.
    for (let i = 1; i < timestamps.length; i++) {
      expect(timestamps[i]).toBeGreaterThan(timestamps[i - 1] ?? 0);
    }
    // و همه داخل پنجرهٔ ۷۲ ساعته‌اند.
    expect(timestamps[0]).toBe(OUTAGE_START);
    expect(timestamps.at(-1)).toBeLessThanOrEqual(OUTAGE_START + OUTAGE_HOURS * HOUR_MS);
  });

  it('قطعی بلندتر از یک بستهٔ تخلیه هم چیزی گم نمی‌کند', async () => {
    // انباشتی بیش از ظرفیت یک چرخه — قطعی واقعاً طولانی.
    core.stop();
    const total = DRAIN_BATCH_SIZE + 7;
    for (let i = 0; i < total; i++) {
      await completeSubmission(env, {
        ...SAMPLE,
        rawAnswers: { observed: `مورد ${i}` },
        submittedAt: OUTAGE_START + i * 60_000,
      });
    }

    core.start();
    // چند چرخه لازم است، درست مثل واقعیت.
    while ((await pendingCount(env.DB)) > 0) await drainOutbox(env);

    expect(core.received).toHaveLength(total);
    expect(new Set(core.receivedIds).size).toBe(total);
    // ترتیب در سراسر چند بسته هم حفظ شده.
    const numbers = core.receivedIds.map((id) => Number(id.replace('REQ-', '')));
    expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
  });
});

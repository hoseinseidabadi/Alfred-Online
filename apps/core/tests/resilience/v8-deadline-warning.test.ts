import { describe, expect, it } from 'vitest';
import {
  AT_RISK_THRESHOLD_DAYS,
  type Clock,
  DeadlineService,
  RESPONSE_COMMITMENT_DAYS,
} from '../../src/modules/intake/deadline.service';

/**
 * ✅ آزمون الزامی ۵ — **هشدار پیش از نقض تعهد**
 *
 * قانون اساسی، بند «تاب‌آوری و آزمون»، مورد پنجم:
 *   «تعهد هفت‌روزه **پیش از** نقض هشدار می‌دهد.»
 *
 * سناریوی متناظر: **V-8** در `quickstart.md`
 *   «ثبتی با `submittedAt` شش روز پیش بساز → انتظار: در بستهٔ تریاژ
 *    `atRisk = true` است، **پیش از** رسیدن به روز هفتم.»
 *
 * راهبرد از R-12: آزمون واحد روی محاسبهٔ مهلت با **زمان کنترل‌شده**. بدون
 * ساعت تزریق‌شونده، این آزمون یا باید شش روز صبر کند یا ساعت سیستم را
 * دست‌کاری کند — هر دو یعنی آزمونی که در عمل اجرا نمی‌شود.
 *
 * شکست این آزمون شکست گیت است، نه یک تست قرمز قابل چشم‌پوشی.
 */

/** ساعتی که دقیقاً همان لحظه‌ای را می‌گوید که آزمون می‌خواهد. */
const frozenAt = (iso: string): Clock => ({ now: () => new Date(iso) });

const SUBMITTED = '2026-08-24T06:44:00Z';
/** روز هفتم — لحظهٔ دقیق نقض. */
const DUE = '2026-08-31T06:44:00.000Z';

describe('✅ آزمون الزامی ۵ — هشدار پیش از نقض تعهد (V-8)', () => {
  it('مهلت دقیقاً هفت روز پس از ثبت است', () => {
    const service = new DeadlineService(frozenAt(SUBMITTED));
    expect(service.dueAt(new Date(SUBMITTED)).toISOString()).toBe(DUE);
    expect(RESPONSE_COMMITMENT_DAYS).toBe(7);
  });

  it('سناریوی V-8 — ثبتِ شش روز پیش، پیش از روز هفتم atRisk است', () => {
    // شش روز از ثبت گذشته؛ یک روز تا مهلت مانده.
    const service = new DeadlineService(frozenAt('2026-08-30T06:44:00Z'));
    const status = service.status(new Date(SUBMITTED));

    expect(status.daysRemaining).toBe(1);
    expect(status.atRisk).toBe(true);
    // و مهم‌تر: هنوز نقض نشده. هشدار **پیش از** نقض آمده.
    expect(service.isBreached(status.responseDueAt, null)).toBe(false);
  });

  it('روز پنجم هنوز هشدار نمی‌دهد — هشدار زودهنگام هم بی‌معناست', () => {
    const service = new DeadlineService(frozenAt('2026-08-28T06:44:00Z'));
    const status = service.status(new Date(SUBMITTED));
    expect(status.daysRemaining).toBe(3);
    expect(status.atRisk).toBe(false);
  });

  it('لحظهٔ دقیق عبور از آستانه', () => {
    const dueAt = new Date(DUE);

    // `daysRemaining` روزِ **کامل** می‌شمارد، پس آستانه روی «دقیقاً سه روز
    // مانده» می‌افتد نه دو روز: با دو روز و یک ثانیه، `Math.floor` عدد ۲
    // می‌دهد و درخواست همان‌جا هشدار می‌گیرد.
    const threeDaysLeft = new DeadlineService(frozenAt('2026-08-28T06:44:00Z'));
    expect(threeDaysLeft.daysRemaining(dueAt)).toBe(AT_RISK_THRESHOLD_DAYS + 1);
    expect(threeDaysLeft.isAtRisk(dueAt)).toBe(false);

    // یک ثانیه بعد، دیگر سه روز کامل نمانده — هشدار شروع می‌شود.
    const justUnder = new DeadlineService(frozenAt('2026-08-28T06:44:01Z'));
    expect(justUnder.daysRemaining(dueAt)).toBe(AT_RISK_THRESHOLD_DAYS);
    expect(justUnder.isAtRisk(dueAt)).toBe(true);
  });

  it('یک ثانیه پیش از نقض، هنوز هشدار است نه نقض', () => {
    const service = new DeadlineService(frozenAt('2026-08-31T06:43:59Z'));
    const dueAt = new Date(DUE);
    expect(service.isAtRisk(dueAt)).toBe(true);
    expect(service.isBreached(dueAt, null)).toBe(false);
  });

  it('یک ثانیه پس از مهلت، نقض شده است', () => {
    const service = new DeadlineService(frozenAt('2026-08-31T06:44:01Z'));
    expect(service.isBreached(new Date(DUE), null)).toBe(true);
  });

  it('درخواستِ نقض‌شده از فهرست هشدارها ناپدید نمی‌شود', () => {
    // اگر `atRisk` پس از نقض `false` می‌شد، دقیقاً چیزی که بیشترین توجه را
    // لازم دارد از دید تریاژ محو می‌گشت.
    const service = new DeadlineService(frozenAt('2026-09-05T00:00:00Z'));
    const dueAt = new Date(DUE);
    expect(service.daysRemaining(dueAt)).toBeLessThan(0);
    expect(service.isAtRisk(dueAt)).toBe(true);
  });

  it('پاسخِ به‌موقع نقض حساب نمی‌شود، حتی اگر حالا خیلی گذشته باشد', () => {
    const service = new DeadlineService(frozenAt('2026-12-01T00:00:00Z'));
    const respondedInTime = new Date('2026-08-28T00:00:00Z');
    expect(service.isBreached(new Date(DUE), respondedInTime)).toBe(false);
  });

  it('پاسخِ دیرهنگام نقض است، حتی اگر بالاخره داده شده باشد', () => {
    const service = new DeadlineService(frozenAt('2026-12-01T00:00:00Z'));
    const respondedLate = new Date('2026-09-02T00:00:00Z');
    expect(service.isBreached(new Date(DUE), respondedLate)).toBe(true);
  });

  it('بدون ساعت تزریق‌شده هم کار می‌کند و از ساعت سیستم می‌خواند', () => {
    const service = new DeadlineService();
    const farFuture = new Date(Date.now() + 30 * 86_400_000);
    expect(service.isAtRisk(farFuture)).toBe(false);
  });
});

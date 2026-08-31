import { describe, expect, it } from 'vitest';
import {
  TEHRAN_TIME_ZONE,
  absoluteDaysBetween,
  addDays,
  formatJalaliDate,
  formatJalaliDateTime,
  formatJalaliLong,
  tehranCalendarDaysBetween,
  toPersianDigits,
  toTehranParts,
} from '../src/index';

/** میان‌بر خوانا برای ساخت لحظهٔ مطلق. */
const at = (iso: string): Date => new Date(iso);

describe('toTehranParts', () => {
  it('لحظهٔ UTC را به اجزای تهران تبدیل می‌کند', () => {
    // ۰۶:۴۴ UTC + ۳:۳۰ = ۱۰:۱۴ تهران
    expect(toTehranParts(at('2026-08-31T06:44:00Z'))).toEqual({
      year: 1405,
      month: 6,
      day: 9,
      hour: 10,
      minute: 14,
    });
  });

  it('تاریخ نامعتبر را رد می‌کند به‌جای اینکه NaN پخش کند', () => {
    expect(() => toTehranParts(new Date('نه یک تاریخ'))).toThrow(TypeError);
  });
});

describe('مرز نیمه‌شب تهران', () => {
  // نیمه‌شب تهران روی ۲۰:۳۰ UTC می‌افتد. یک دقیقه این‌ور و آن‌ورش دو روز
  // تقویمی متفاوت است — همان جایی که «عمر خرابی» می‌تواند یک روز غلط شود.
  it('۲۰:۲۹ UTC هنوز همان روز تهران است', () => {
    const p = toTehranParts(at('2026-08-31T20:29:00Z'));
    expect([p.day, p.hour, p.minute]).toEqual([9, 23, 59]);
  });

  it('۲۰:۳۱ UTC روز بعدِ تهران است', () => {
    const p = toTehranParts(at('2026-08-31T20:31:00Z'));
    expect([p.day, p.hour, p.minute]).toEqual([10, 0, 1]);
  });

  it('دقیقاً ۲۰:۳۰ UTC نیمه‌شب روز بعد است', () => {
    const p = toTehranParts(at('2026-08-31T20:30:00Z'));
    expect([p.day, p.hour, p.minute]).toEqual([10, 0, 0]);
  });
});

describe('مرز سال جلالی', () => {
  it('نوروز ۱۴۰۶ روی ۲۰۲۷/۰۳/۲۱ می‌افتد', () => {
    const p = toTehranParts(at('2027-03-20T21:00:00Z'));
    expect([p.year, p.month, p.day]).toEqual([1406, 1, 1]);
  });

  it('آخرین روز ۱۴۰۵ اسفند است، نه فروردین', () => {
    const p = toTehranParts(at('2027-03-20T20:00:00Z'));
    expect([p.year, p.month]).toEqual([1405, 12]);
  });
});

describe('addDays — مطلق، نه تقویمی', () => {
  it('تعهد هفت‌روزه دقیقاً ۱۶۸ ساعت است', () => {
    const submitted = at('2026-08-24T06:44:00Z');
    expect(addDays(submitted, 7).toISOString()).toBe('2026-08-31T06:44:00.000Z');
  });

  it('ساعتِ تهران را هم دست‌نخورده نگه می‌دارد چون آفست ثابت است', () => {
    const before = toTehranParts(at('2026-08-24T06:44:00Z'));
    const after = toTehranParts(addDays(at('2026-08-24T06:44:00Z'), 7));
    expect([after.hour, after.minute]).toEqual([before.hour, before.minute]);
  });

  it('روز منفی هم می‌پذیرد', () => {
    expect(addDays(at('2026-08-31T00:00:00Z'), -1).toISOString()).toBe('2026-08-30T00:00:00.000Z');
  });

  it('عدد نامعتبر را رد می‌کند', () => {
    expect(() => addDays(at('2026-08-31T00:00:00Z'), Number.NaN)).toThrow(RangeError);
  });
});

describe('absoluteDaysBetween', () => {
  it('روز کامل را رو به پایین گرد می‌کند', () => {
    // ۶ روز و ۲۳ ساعت هنوز ۶ روز است — مهلت هفت‌روزه هنوز نقض نشده.
    expect(absoluteDaysBetween(at('2026-08-24T00:00:00Z'), at('2026-08-30T23:00:00Z'))).toBe(6);
  });

  it('وقتی مقصد پیش از مبدأ است منفی برمی‌گردد', () => {
    expect(absoluteDaysBetween(at('2026-08-31T00:00:00Z'), at('2026-08-24T00:00:00Z'))).toBe(-7);
  });
});

describe('tehranCalendarDaysBetween — با مطلق یکی نیست', () => {
  it('دو لحظه به فاصلهٔ دو ساعت، اگر نیمه‌شب تهران بینشان باشد، یک روز فرق دارند', () => {
    const before = at('2026-08-31T19:30:00Z'); // ۲۳:۰۰ تهران، روز ۹
    const after = at('2026-08-31T21:30:00Z'); // ۰۱:۰۰ تهران، روز ۱۰
    expect(tehranCalendarDaysBetween(before, after)).toBe(1);
    // همان دو لحظه از دید مطلق صفر روز فاصله دارند.
    expect(absoluteDaysBetween(before, after)).toBe(0);
  });

  it('۲۳ ساعت داخل یک روز تقویمی، صفر روز است', () => {
    expect(tehranCalendarDaysBetween(at('2026-08-31T20:30:00Z'), at('2026-09-01T19:00:00Z'))).toBe(
      0,
    );
  });

  it('روی مرز سال جلالی درست می‌شمارد', () => {
    // ۱۴۰۵/۱۲/۲۹ به ۱۴۰۶/۰۱/۰۱ باید یک روز باشد، نه بیشتر.
    const lastDayOf1405 = at('2027-03-20T12:00:00Z');
    const nowruz1406 = at('2027-03-21T12:00:00Z');
    expect(tehranCalendarDaysBetween(lastDayOf1405, nowruz1406)).toBe(1);
  });

  it('روی بازهٔ بلند با مرز سال، با شمارش مطلق می‌خواند', () => {
    const from = at('2027-03-01T12:00:00Z');
    const to = at('2027-04-30T12:00:00Z');
    expect(tehranCalendarDaysBetween(from, to)).toBe(absoluteDaysBetween(from, to));
  });
});

describe('قالب‌بندی — همه فارسی، هیچ رقم لاتین', () => {
  const instant = at('2026-08-31T06:44:00Z');

  it('قالب کوتاه', () => {
    expect(formatJalaliDate(instant)).toBe('۱۴۰۵/۰۶/۰۹');
  });

  it('قالب با ساعت', () => {
    expect(formatJalaliDateTime(instant)).toBe('۱۴۰۵/۰۶/۰۹ ساعت ۱۰:۱۴');
  });

  it('قالب بلند با نام ماه', () => {
    expect(formatJalaliLong(instant)).toBe('۹ شهریور ۱۴۰۵');
  });

  it('هیچ خروجی نمایشی رقم لاتین ندارد', () => {
    for (const out of [
      formatJalaliDate(instant),
      formatJalaliDateTime(instant),
      formatJalaliLong(instant),
    ]) {
      expect(out).not.toMatch(/[0-9]/);
    }
  });

  it('نیمه‌شب را ۰۰ نشان می‌دهد نه ۲۴', () => {
    expect(formatJalaliDateTime(at('2026-08-31T20:30:00Z'))).toBe('۱۴۰۵/۰۶/۱۰ ساعت ۰۰:۰۰');
  });
});

describe('toPersianDigits', () => {
  it('ارقام را تبدیل می‌کند و بقیهٔ متن را دست نمی‌زند', () => {
    expect(toPersianDigits('۳ از 12 مورد')).toBe('۳ از ۱۲ مورد');
    expect(toPersianDigits(1405)).toBe('۱۴۰۵');
  });
});

describe('قید ماژول', () => {
  it('منطقهٔ زمانی تهران است', () => {
    expect(TEHRAN_TIME_ZONE).toBe('Asia/Tehran');
  });

  it('هیچ تابع صادرشده‌ای اسم میلادی ندارد', async () => {
    // اصل «زبان و تقویم»: این ماژول نباید راهی برای گرفتن تاریخ میلادی بدهد.
    const mod = await import('../src/index');
    const suspicious = Object.keys(mod).filter((k) => /gregor|miladi|western/i.test(k));
    expect(suspicious).toEqual([]);
  });
});

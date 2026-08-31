import { describe, expect, it } from 'vitest';
import { formatJalaliDateTime, toTehranParts } from '@alfred-online/jalali';

/**
 * این آزمون دربارهٔ منطق تاریخ نیست — آن در `packages/jalali/tests` سنجیده شده.
 *
 * اینجا یک **فرض زیرساختی** سنجیده می‌شود: تقویم فارسی و منطقهٔ زمانی تهران از
 * `Intl` می‌آیند، که به دادهٔ ICU زمان اجرا وابسته است. Node آن را کامل دارد،
 * ولی زمان اجرای Cloudflare Workers یک محیط دیگر است.
 *
 * اگر این آزمون بشکند، پیام تأیید ثبت (T041) نمی‌تواند مهلت هفت‌روزه را به
 * تاریخ جلالی نشان دهد و بند «زبان، تقویم و لحن» قانون اساسی در لبه نقض می‌شود —
 * آن‌وقت R-07 باید بازنویسی شود و یک جدول تبدیل دستی جایش بنشیند.
 */
describe('تقویم فارسی در زمان اجرای Workers', () => {
  const instant = new Date('2026-08-31T06:44:00Z');

  it('دادهٔ ICU تقویم فارسی را می‌شناسد', () => {
    expect(Intl.DateTimeFormat.supportedLocalesOf(['fa-IR-u-ca-persian'])).not.toHaveLength(0);
  });

  it('منطقهٔ زمانی Asia/Tehran را می‌شناسد', () => {
    expect(() =>
      new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tehran' }).format(instant),
    ).not.toThrow();
  });

  it('همان اجزایی را می‌دهد که Node می‌دهد', () => {
    expect(toTehranParts(instant)).toEqual({
      year: 1405,
      month: 6,
      day: 9,
      hour: 10,
      minute: 14,
    });
  });

  it('پیام تأیید ثبت با تاریخ جلالی قابل ساخت است', () => {
    expect(formatJalaliDateTime(instant)).toBe('۱۴۰۵/۰۶/۰۹ ساعت ۱۰:۱۴');
  });
});

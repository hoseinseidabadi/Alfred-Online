/**
 * تاریخ جلالی و ساعت تهران — ماژول مشترک هر سه اپ.
 *
 * قاعدهٔ حاکم (R-07، بند «زبان، تقویم و لحن» قانون اساسی):
 *   ذخیره‌سازی **همیشه** UTC؛ تبدیل تقویمی **فقط** در لایهٔ نمایش.
 *
 * محاسبهٔ مهلت هفت‌روزه و عمر خرابی روی زمان مطلق انجام می‌شود، نه روی رشتهٔ
 * تقویمی — تبدیل در لایهٔ منطق منبع خطاست.
 *
 * این ماژول عمداً **هیچ تابعی که تاریخ میلادی به بیرون بدهد صادر نمی‌کند.**
 * اگر روزی چنین تابعی اینجا اضافه شد، یعنی قاعده شکسته شده.
 *
 * تقویم و منطقهٔ زمانی از `Intl` می‌آیند (ICU)، نه از کتابخانهٔ جانبی — ایران از
 * ۱۴۰۱ ساعت تابستانی ندارد، پس آفست تهران ثابت `+03:30` است، ولی به آن تکیه
 * نمی‌کنیم و همیشه از `timeZone: 'Asia/Tehran'` استفاده می‌شود.
 */

export const TEHRAN_TIME_ZONE = 'Asia/Tehran';

const MS_PER_DAY = 86_400_000;

/** اجزای تاریخ و ساعت تهران، به‌صورت عدد. */
export interface TehranParts {
  /** سال جلالی، مثلاً ۱۴۰۵ */
  year: number;
  /** ماه جلالی، ۱ تا ۱۲ */
  month: number;
  /** روز ماه، ۱ تا ۳۱ */
  day: number;
  /** ساعت به فرمت ۲۴ ساعته، ۰ تا ۲۳ */
  hour: number;
  /** دقیقه، ۰ تا ۵۹ */
  minute: number;
}

/** نام ماه‌های جلالی — برای قالب بلند. */
const MONTH_NAMES = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
] as const;

/**
 * قالب‌بند با ارقام لاتین — فقط برای استخراج عدد استفاده می‌شود، نه نمایش.
 * ساخت `Intl.DateTimeFormat` گران است، پس یک بار ساخته و بازاستفاده می‌شود.
 */
const numericFormatter = new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn', {
  timeZone: TEHRAN_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/**
 * قالب‌بند میلادیِ تهران — **فقط** برای محاسبهٔ آفست منطقهٔ زمانی، داخلی و
 * صادرنشده. این تنها جای ماژول است که تقویم میلادی لمس می‌شود و هیچ خروجی‌اش
 * به بیرون نمی‌رسد.
 */
const gregorianTehranFormatter = new Intl.DateTimeFormat('en-US-u-ca-gregory-nu-latn', {
  timeZone: TEHRAN_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

/** ارقام فارسی ۰ تا ۹ به‌ترتیب. */
const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'] as const;

/**
 * هر رقم لاتین را به معادل فارسی‌اش تبدیل می‌کند.
 * روی شناسه‌هایی مثل `REQ-149` **استفاده نشود** — آن‌ها را آدم‌ها در جلسه به
 * زبان می‌آورند و باید لاتین بمانند.
 */
export function toPersianDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => PERSIAN_DIGITS[Number(d)] ?? d);
}

/** اجزای تاریخ و ساعت تهران را از یک لحظهٔ مطلق بیرون می‌کشد. */
export function toTehranParts(instant: Date): TehranParts {
  assertValid(instant);
  const parts: Record<string, string> = {};
  for (const part of numericFormatter.formatToParts(instant)) {
    if (part.type !== 'literal') parts[part.type] = part.value;
  }
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    // در فرمت ۲۴ ساعته، نیمه‌شب در بعضی محیط‌ها `24` گزارش می‌شود.
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
  };
}

/** `۱۴۰۵/۰۶/۰۹` — قالب کوتاه، ارقام فارسی. */
export function formatJalaliDate(instant: Date): string {
  const { year, month, day } = toTehranParts(instant);
  return toPersianDigits(`${year}/${pad2(month)}/${pad2(day)}`);
}

/** `۱۴۰۵/۰۶/۰۹ ساعت ۱۰:۱۴` — تاریخ و ساعت تهران. */
export function formatJalaliDateTime(instant: Date): string {
  const { hour, minute } = toTehranParts(instant);
  return `${formatJalaliDate(instant)} ساعت ${toPersianDigits(`${pad2(hour)}:${pad2(minute)}`)}`;
}

/** `۹ شهریور ۱۴۰۵` — قالب بلند برای متن پیام‌ها. */
export function formatJalaliLong(instant: Date): string {
  const { year, month, day } = toTehranParts(instant);
  const name = MONTH_NAMES[month - 1];
  if (name === undefined) throw new RangeError(`ماه جلالی نامعتبر: ${month}`);
  return `${toPersianDigits(day)} ${name} ${toPersianDigits(year)}`;
}

/**
 * `n` روز **مطلق** به یک لحظه اضافه می‌کند.
 *
 * این همان چیزی است که مهلت هفت‌روزه با آن حساب می‌شود
 * (`responseDueAt = submittedAt + 7d`، قرارداد bridge-api). عمداً تقویمی نیست:
 * تعهد هفت‌روزه یعنی ۱۶۸ ساعت، نه «هفت بار عوض شدن تاریخ تهران».
 */
export function addDays(instant: Date, days: number): Date {
  assertValid(instant);
  if (!Number.isFinite(days)) throw new RangeError(`تعداد روز نامعتبر: ${days}`);
  return new Date(instant.getTime() + days * MS_PER_DAY);
}

/**
 * فاصلهٔ **مطلق** میان دو لحظه، برحسب روز کامل (رو به پایین گرد می‌شود).
 * برای `daysRemaining` مهلت پاسخ. اگر `to` پیش از `from` باشد، منفی برمی‌گردد.
 */
export function absoluteDaysBetween(from: Date, to: Date): number {
  assertValid(from);
  assertValid(to);
  return Math.floor((to.getTime() - from.getTime()) / MS_PER_DAY);
}

/**
 * اختلاف **روز تقویمی تهران** میان دو لحظه.
 *
 * برای «عمر قدیمی‌ترین خرابی چند روز است» در داشبورد — چیزی که آدم با نگاه به
 * تقویم می‌شمارد. با `absoluteDaysBetween` یکی نیست و نباید جایش استفاده شود:
 * دو لحظه به فاصلهٔ یک ساعت که مرز نیمه‌شب تهران بینشان باشد، از این تابع `۱`
 * می‌گیرند و از آن یکی `۰`.
 */
export function tehranCalendarDaysBetween(from: Date, to: Date): number {
  return toTehranDayNumber(to) - toTehranDayNumber(from);
}

/**
 * شمارهٔ روز تقویمی تهران — مبدأ دلخواه، فقط برای تفریق.
 *
 * عمداً هیچ حساب جلالی‌ای اینجا نیست: «یک روز تقویمی در تهران» مجموعهٔ یکسانی از
 * لحظه‌هاست، فارغ از اینکه با کدام تقویم نامش ببری. پس کافی است لحظه را با آفست
 * تهران جابه‌جا کنیم و تقسیم صحیح بر طول روز بگیریم. این کار مرز سال و کبیسه را
 * هم خودبه‌خود درست می‌کند.
 */
function toTehranDayNumber(instant: Date): number {
  return Math.floor((instant.getTime() + tehranOffsetMs(instant)) / MS_PER_DAY);
}

/**
 * آفست تهران در یک لحظهٔ مشخص، برحسب میلی‌ثانیه.
 *
 * ایران از ۱۴۰۱ ساعت تابستانی ندارد و آفست ثابت `+03:30` است، ولی عمداً
 * hard-code نشده — اگر روزی برگردد، این تابع خودش درست می‌ماند.
 */
function tehranOffsetMs(instant: Date): number {
  const parts: Record<string, string> = {};
  for (const part of gregorianTehranFormatter.formatToParts(instant)) {
    if (part.type !== 'literal') parts[part.type] = part.value;
  }
  const wallClockAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );
  // قالب‌بند تا ثانیه دقت دارد، پس میلی‌ثانیهٔ ورودی باید کنار گذاشته شود.
  const instantToSecond = Math.floor(instant.getTime() / 1000) * 1000;
  return wallClockAsUtc - instantToSecond;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function assertValid(instant: Date): void {
  if (!(instant instanceof Date) || Number.isNaN(instant.getTime())) {
    throw new TypeError('تاریخ نامعتبر است');
  }
}

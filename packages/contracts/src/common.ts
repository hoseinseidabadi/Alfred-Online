/**
 * تایپ‌های مشترک هر دو قرارداد.
 *
 * منبع: [data-model.md](../../../specs/001-request-intake-triage/data-model.md)
 * و منشور P-06 در مخزن دانش Alfred.
 */

/**
 * واحد سازمانی ثبت‌کننده.
 *
 * فهرست از منشور P-06 می‌آید: «در کدام واحد کار می‌کنی؟ تحریریه / فنی /
 * بازرگانی / مدیریت / سایر». یک بار پرسیده می‌شود و برای همیشه می‌ماند (FR-003).
 */
export type Unit = 'editorial' | 'technical' | 'commercial' | 'management' | 'other';

/** حدس ثبت‌کننده دربارهٔ نوع درخواست. تریاژ می‌تواند عوضش کند بدون تغییر شناسه. */
export type RequestType = 'bug' | 'improvement' | 'idea';

/** چرخهٔ عمر درخواست. */
export type RequestStatus = 'new' | 'triaged' | 'queued' | 'in_progress' | 'answered' | 'closed';

/** چهار سرنوشت تریاژ (FR-028). */
export type TriageOutcome = 'convert' | 'merge' | 'reject' | 'need_data';

/** نوع پاسخ مکتوب — با سرنوشت تریاژ یکی است. */
export type ResponseKind = TriageOutcome;

/** از کجا وارد سامانه شد. */
export type RequestSource = 'bot' | 'fast_track' | 'manual';

/** وضعیت دسترسی ثبت‌کننده. */
export type AccessStatus = 'member' | 'exception' | 'revoked';

/** مرجع تصمیم — نرخ موفقیت به تفکیک همین گزارش می‌شود (FR-044). */
export type DecisionForum = 'council' | 'fast_track';

/** نتیجهٔ تصمیم. */
export type DecisionOutcome = 'execute' | 'park' | 'reject';

/** نتیجهٔ بازبینی در تاریخ مقرر (FR-041). */
export type ReviewOutcome = 'worked' | 'did_not_work' | 'inconclusive';

/** ابعادی که از پاسخ انسانی استخراج می‌شوند (اصل II). */
export type DerivedDimension = 'confidence' | 'severity' | 'impact';

/** نوع پیوست اختیاری (FR-011). */
export type AttachmentKind = 'photo' | 'document' | 'link';

export interface Attachment {
  kind: AttachmentKind;
  ref: string;
}

/**
 * پاسخ‌های خام کاربر — **عین متن فارسی، تغییرناپذیر پس از درج**.
 *
 * اصل II و ناوردای ۱: هیچ مصرف‌کننده‌ای MUST NOT این را نرمال‌سازی، خلاصه یا
 * بازنویسی کند. مقادیر استخراجی جای دیگری زندگی می‌کنند (`DerivedValue`).
 */
export type RawAnswers = Readonly<Record<string, string>>;

/** ارجاع سبک به مخزن دانش — فقط ارجاع، هرگز محتوا (اصل I، FR-052). */
export interface KnowledgeRef {
  kind: 'service' | 'process' | 'event' | 'idea';
  ref: string;
  /** فقط برای نمایش کش می‌شود و منبع حقیقت نیست. */
  title?: string;
}

/**
 * زمان در هر دو قرارداد ISO-8601 با منطقهٔ UTC است.
 * **هیچ تاریخ جلالی در سیم رد و بدل نمی‌شود** — تبدیل فقط در لایهٔ نمایش (R-07).
 */
export type IsoUtcTimestamp = string;

/** تاریخ بدون ساعت، به‌صورت `YYYY-MM-DD` میلادی — فقط برای انتقال، نه نمایش. */
export type IsoDate = string;

/**
 * تعهد پاسخ مکتوب، برحسب روز — به تفکیک نوع درخواست.
 *
 * اصل IV قانون اساسی می‌گوید «**حداکثر** ظرف هفت روز». هفت، **سقف** است نه
 * هدف؛ پس تعهد کوتاه‌تر برای خرابی سخت‌گیرانه‌تر از ناوردا است، نه ناقض آن.
 *
 * **چرا خرابی جدا شد**: عدد ۷ از منشور P-06 آمد که منشورِ *ورود ایده* است، و
 * spec آن را یکنواخت به خرابی هم داد. یکنواختی‌اش تصمیم نبود، سرایت بود.
 * خرابی بررسی سریع می‌خواهد.
 *
 * **چرا ۳ و نه ۱ یا ۲**: آخر هفتهٔ ایرانی. خرابی‌ای که چهارشنبه شب ثبت شود، با
 * تعهد یک‌روزه جمعه نقض می‌شود. سه روز یک آخر هفته را جذب می‌کند و بدون
 * تقویم تعطیلات رسمی هم قابل نگه‌داشتن است — که خودش یک پروژهٔ جداست
 * (اصل VII).
 */
export const RESPONSE_COMMITMENT_DAYS: Readonly<Record<RequestType, number>> = {
  bug: 3,
  improvement: 7,
  idea: 7,
};

/** سقف قانون اساسی. هیچ تعهدی MUST NOT از این بیشتر باشد. */
export const MAX_RESPONSE_COMMITMENT_DAYS = 7;

/**
 * مهلت پاسخ برای یک نوع درخواست.
 *
 * **قولی که به ثبت‌کننده داده شده پس گرفته نمی‌شود.** اگر تریاژ نوع را از
 * «خرابی» به «بهبود» عوض کند، مهلت **تمدید نمی‌شود** — فقط می‌تواند کوتاه‌تر
 * شود. هزینه‌اش کم است و ناوردا را صادق نگه می‌دارد.
 */
export function commitmentDaysFor(type: RequestType): number {
  return RESPONSE_COMMITMENT_DAYS[type];
}

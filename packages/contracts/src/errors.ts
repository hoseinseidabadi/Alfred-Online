/**
 * کدهای خطای قرارداد.
 *
 * این‌ها همان چیزی هستند که اصل IV و V را از شعار به کد تبدیل می‌کنند. هر کد
 * یک ناوردای قانون اساسی را نگه می‌دارد و هرکدام وظیفهٔ پیاده‌سازی مستقل خودش
 * را دارد (T056 تا T060، T082 تا T084).
 *
 * منبع: [contracts/triage-api.md](../../../specs/001-request-intake-triage/contracts/triage-api.md)
 */

export const ContractErrorCode = {
  /** `outcome = reject` و یکی از سه بخش خالی — FR-031، ناوردای ۵. */
  REJECT_INCOMPLETE: 'REJECT_INCOMPLETE',
  /** `response.approvedBy` خالی — اصل IV، FR-033. هیچ پاسخی بدون تأیید انسان. */
  APPROVAL_REQUIRED: 'APPROVAL_REQUIRED',
  /** `serviceRef` خالی و `"unknown"` هم صریحاً نیامده — FR-022، SC-009. */
  SERVICE_REF_REQUIRED: 'SERVICE_REF_REQUIRED',
  /** `outcome = merge` بدون `mergedInto`. */
  MERGE_TARGET_REQUIRED: 'MERGE_TARGET_REQUIRED',
  /** `outcome = execute` بدون متریک یا تاریخ بازبینی — اصل V، FR-040. */
  METRIC_AND_REVIEW_REQUIRED: 'METRIC_AND_REVIEW_REQUIRED',
  /** بیش از یک متریک موفقیت — اصل V، ناوردای ۶. */
  EXACTLY_ONE_METRIC: 'EXACTLY_ONE_METRIC',
  /** جلسهٔ `council` با کمتر از سه کارت — FR-039، ناوردای ۸. */
  MIN_THREE_CARDS: 'MIN_THREE_CARDS',
  /** تلاش برای تغییر `rawAnswers` — اصل II، ناوردای ۱، FR-024. */
  IMMUTABLE: 'IMMUTABLE',
} as const;

export type ContractErrorCode = (typeof ContractErrorCode)[keyof typeof ContractErrorCode];

/**
 * وضعیت HTTP هر کد.
 *
 * `IMMUTABLE` تنها موردی است که `403` می‌گیرد نه `422`: بقیه «ورودی‌ات ناقص
 * است، اصلاحش کن» می‌گویند، ولی این یکی «این کار اصلاً مجاز نیست» — هیچ اصلاحی
 * در ورودی آن را قابل قبول نمی‌کند.
 */
export const CONTRACT_ERROR_STATUS: Readonly<Record<ContractErrorCode, 403 | 422>> = {
  REJECT_INCOMPLETE: 422,
  APPROVAL_REQUIRED: 422,
  SERVICE_REF_REQUIRED: 422,
  MERGE_TARGET_REQUIRED: 422,
  METRIC_AND_REVIEW_REQUIRED: 422,
  EXACTLY_ONE_METRIC: 422,
  MIN_THREE_CARDS: 422,
  IMMUTABLE: 403,
};

/** بدنهٔ خطای یکسان برای هر دو قرارداد. */
export interface ContractError {
  code: ContractErrorCode;
  /** پیام فارسی، رو به مصرف‌کنندهٔ انسانی. */
  message: string;
  /** فیلدهایی که باعث رد شدن شدند، اگر قابل تعیین باشند. */
  fields?: string[];
}

/**
 * **استثنای مسیر سریع** — اصل V، FR-042، FR-043.
 *
 * `forum = fast_track` بدون `successMetric` و `reviewDate` هم **پذیرفته
 * می‌شود** و آیتم بلافاصله وارد اجرا می‌گردد. رکورد `incomplete` علامت می‌خورد
 * و پس از این مدت در فهرست هشدار ظاهر می‌شود. **اجرا هرگز مسدود نمی‌شود.**
 *
 * یعنی `METRIC_AND_REVIEW_REQUIRED` و `EXACTLY_ONE_METRIC` برای این مسیر دور
 * زده می‌شوند — نه حذف. اگر همان درخواست با `forum = council` بیاید، هر دو
 * دوباره اعمال می‌شوند.
 */
export const FAST_TRACK_COMPLETION_WINDOW_HOURS = 48;

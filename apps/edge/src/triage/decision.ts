import { ContractErrorCode, type TriageOutcome } from '@alfred-online/contracts';

/**
 * تصمیم تریاژ که از میز تلگرامی می‌آید — و اعتبارسنجی‌اش.
 *
 * **چرا اعتبارسنجی در لبه تکرار می‌شود** با اینکه هسته هم داردش:
 *
 * پاسخ **پیش از** رسیدن به هسته به ثبت‌کننده تحویل می‌شود (اصل III — وگرنه در
 * قطعی گیر می‌کند). یعنی اگر لبه اعتبارسنجی نکند، ممکن است چیزی بفرستیم که
 * هسته بعداً با `422` ردش کند — و آن پیام دیگر برگشتنی نیست.
 *
 * پس این تکرار **عمدی و لازم** است، نه بی‌دقتی. هسته همچنان اعتبارسنجی خودش
 * را دارد؛ لبه دروازهٔ جلویی است.
 */

export interface QuickDecisionInput {
  requestId: string;
  chatId: string;
  outcome: TriageOutcome;
  body: string;
  /** هر سه وقتی `outcome = reject` الزامی‌اند — FR-031، ناوردای ۵. */
  rejectUnderstood?: string;
  rejectWhyNot?: string;
  rejectWhenYes?: string;
  /** چه کسی تأیید کرد — FR-033. هرگز خالی نیست. */
  approvedBy: string;
}

export type ValidationResult = { valid: true } | { valid: false; code: string; message: string };

const nonEmpty = (value: string | undefined): boolean =>
  value !== undefined && value.trim().length > 0;

/**
 * همان قیدهایی که هسته اعمال می‌کند، پیش از تحویل.
 *
 * فهرست عمداً کوتاه است: میز سریع **پاسخ می‌دهد، نمی‌بندد**. `serviceRef` و
 * متریک در نشست کامل تریاژ می‌آیند، پس `SERVICE_REF_REQUIRED` اینجا اعمال
 * نمی‌شود — SC-009 دربارهٔ **بستن** است نه پاسخ دادن.
 */
export function validateQuickDecision(input: QuickDecisionInput): ValidationResult {
  if (!nonEmpty(input.approvedBy)) {
    return {
      valid: false,
      code: ContractErrorCode.APPROVAL_REQUIRED,
      message: 'هیچ پاسخی بدون تأیید انسان ارسال نمی‌شود.',
    };
  }

  if (!nonEmpty(input.body)) {
    return {
      valid: false,
      code: 'EMPTY_BODY',
      message: 'متن پاسخ خالی است.',
    };
  }

  if (input.outcome === 'reject') {
    const missing = [
      nonEmpty(input.rejectUnderstood) ? null : 'چه فهمیدیم',
      nonEmpty(input.rejectWhyNot) ? null : 'چرا الان نه',
      nonEmpty(input.rejectWhenYes) ? null : 'در چه شرایطی بله',
    ].filter((part): part is string => part !== null);

    if (missing.length > 0) {
      return {
        valid: false,
        code: ContractErrorCode.REJECT_INCOMPLETE,
        message: `پاسخ رد بدون این بخش‌ها ارسال نمی‌شود: ${missing.join('، ')}`,
      };
    }
  }

  return { valid: true };
}

/**
 * متن نهاییِ رسیده به ثبت‌کننده.
 *
 * برای رد، سه بخش با تیتر می‌آیند — نه چون قالب قشنگ است، بلکه چون منشور P-06
 * می‌گوید «رد مستدل اعتماد می‌سازد؛ سکوت آن را نابود می‌کند». سه بخشِ بدون
 * تیتر، یک پاراگرافِ مبهم می‌شود و همان اثر را ندارد.
 */
export function composeResponseBody(input: QuickDecisionInput): string {
  const header = `${input.requestId} — ${OUTCOME_LABEL[input.outcome]}`;

  if (input.outcome !== 'reject') {
    return [header, '', input.body].join('\n');
  }

  return [
    header,
    '',
    `چه فهمیدیم: ${input.rejectUnderstood?.trim() ?? ''}`,
    '',
    `چرا الان نه: ${input.rejectWhyNot?.trim() ?? ''}`,
    '',
    `در چه شرایطی بله: ${input.rejectWhenYes?.trim() ?? ''}`,
  ].join('\n');
}

/** برچسب فارسی هر سرنوشت، رو به ثبت‌کننده. */
export const OUTCOME_LABEL: Readonly<Record<TriageOutcome, string>> = {
  convert: 'بررسی شد ✅',
  merge: 'با یک درخواست دیگر یکی شد 🔗',
  reject: 'فعلاً نه ❌',
  need_data: 'به اطلاعات بیشتری نیاز داریم ❓',
};

/** گزینه‌های سرنوشت، برای دکمه‌های میز تریاژ. */
export const OUTCOME_CHOICES: readonly { value: string; label: string }[] = [
  { value: '__outcome:convert', label: '✅ بررسی شد / در دست اقدام' },
  { value: '__outcome:need_data', label: '❓ اطلاعات بیشتر می‌خواهم' },
  { value: '__outcome:reject', label: '❌ فعلاً نه' },
  { value: '__outcome:merge', label: '🔗 تکراری است' },
];

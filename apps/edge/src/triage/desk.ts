import { commitmentDaysFor, type TriageOutcome } from '@alfred-online/contracts';
import { addDays, formatJalaliDateTime, toPersianDigits } from '@alfred-online/jalali';
import { questionsFor, roleQuestionFor } from '../conversation/questions';
import type { StoredSubmission } from '../submission/store';
import { OUTCOME_CHOICES } from './decision';

/**
 * میز تریاژ در تلگرام — رو به **مدیر محصول**، نه ثبت‌کننده.
 *
 * چرا وجود دارد: تعهد سه‌روزهٔ خرابی فقط وقتی قابل نگه‌داشتن است که بشود از
 * گوشی تریاژ کرد. نشست هفتگی سی‌دقیقه‌ای برای هفت روز کافی بود، برای سه روز نه.
 *
 * **این یک مصرف‌کنندهٔ تازهٔ همان قرارداد است، نه یک قرارداد تازه.** R-10
 * صراحتاً گفته بود قرارداد تریاژ «دربارهٔ اینکه چه کسی تحلیل می‌کند بی‌طرف
 * است» و FR-054 همین را پیش‌بینی کرده بود.
 */

/** آیا این حساب، مدیر محصول است. */
export function isProductManager(
  chatId: string,
  env: { PRODUCT_MANAGER_CHAT_ID?: string },
): boolean {
  const configured = env.PRODUCT_MANAGER_CHAT_ID;
  if (configured === undefined || configured.trim().length === 0) return false;
  return configured.trim() === chatId;
}

const TYPE_LABEL: Record<StoredSubmission['requestType'], string> = {
  bug: '🔴 خرابی',
  improvement: '🟡 بهبود',
  idea: '🟢 ایده',
};

const UNIT_LABEL: Record<StoredSubmission['unit'], string> = {
  editorial: 'تحریریه',
  technical: 'فنی',
  commercial: 'بازرگانی',
  management: 'مدیریت',
  other: 'سایر',
};

/**
 * خلاصهٔ یک ثبت، رو به مدیر محصول.
 *
 * **پاسخ‌های خام عیناً می‌آیند** — با متن پرسشی که تولیدشان کرده. اصل II
 * می‌گوید داده دست‌نخورده بماند؛ اینجا یعنی تریاژ همان چیزی را می‌بیند که
 * ثبت‌کننده نوشت، نه خلاصه‌ای از آن.
 */
export function summarize(submission: StoredSubmission, now: number): string {
  const dueAt = addDays(
    new Date(submission.submittedAt),
    commitmentDaysFor(submission.requestType),
  );
  const daysLeft = Math.floor((dueAt.getTime() - now) / 86_400_000);

  const deadline =
    daysLeft > 0
      ? `${toPersianDigits(daysLeft)} روز تا مهلت`
      : daysLeft === 0
        ? '⚠️ مهلت امروز است'
        : `🚨 ${toPersianDigits(Math.abs(daysLeft))} روز از مهلت گذشته`;

  const lines = [
    `${TYPE_LABEL[submission.requestType]} · ${submission.requestId}`,
    `${submission.submitterName} · ${UNIT_LABEL[submission.unit]}`,
    `${formatJalaliDateTime(new Date(submission.submittedAt))} · ${deadline}`,
    '',
  ];

  // پرسش‌ها به‌ترتیب اصلی، با متن خودشان — تا معلوم باشد هر جواب به چه چیزی است.
  const questions = [...questionsFor(submission.requestType), roleQuestionFor(submission.unit)];
  for (const question of questions) {
    const answer = submission.rawAnswers[question.key];
    if (answer === undefined) continue;
    const label = question.choices?.find((c) => c.value === answer)?.label ?? answer;
    lines.push(`▸ ${question.prompt}`, `   ${label}`);
  }

  if (submission.attachments.length > 0) {
    lines.push('', `📎 ${toPersianDigits(submission.attachments.length)} پیوست`);
  }

  return lines.join('\n');
}

/** دکمهٔ زیر اعلان — شروع پاسخ به همین درخواست. */
export function replyChoicesFor(requestId: string): { value: string; label: string }[] {
  return [{ value: `__reply:${requestId}`, label: '✍️ پاسخ می‌دهم' }];
}

export { OUTCOME_CHOICES };

/** متن‌های میز تریاژ. جدا از متن‌های ثبت‌کننده چون مخاطبشان فرق دارد. */
export const deskMessages = {
  newBugAlert: '🔔 خرابی تازه ثبت شد',

  chooseOutcome: 'سرنوشتش چیست؟',

  askBody: 'متن پاسخ را بنویس. عیناً همین به ثبت‌کننده می‌رسد.',

  /** سه پرسش رد — FR-031. یکی‌یکی، چون روی گوشی همین کار می‌کند. */
  askUnderstood: '۱ از ۳ — چه فهمیدیم؟',
  askWhyNot: '۲ از ۳ — چرا الان نه؟',
  askWhenYes: '۳ از ۳ — در چه شرایطی بله؟',

  rejectIntro: [
    'پاسخ رد سه بخش دارد و هر سه الزامی‌اند.',
    '',
    'منشور P-06: «رد مستدل اعتماد می‌سازد؛ سکوت آن را نابود می‌کند.»',
  ].join('\n'),

  emptyInbox: 'چیزی بدون پاسخ نمانده 🎉',

  inboxHeader: (count: number) => `${toPersianDigits(count)} درخواست بدون پاسخ:`,

  inboxFilters: [
    { value: '__inbox:bug', label: '🔴 فقط خرابی' },
    { value: '__inbox:improvement', label: '🟡 فقط بهبود' },
    { value: '__inbox:idea', label: '🟢 فقط ایده' },
    { value: '__inbox:all', label: 'همه' },
  ],

  alreadyAnswered: 'این درخواست قبلاً پاسخ گرفته است.',

  notFound: 'این شماره را پیدا نکردم.',

  sent: (requestId: string, responseId: string) =>
    [
      `پاسخ ${responseId} برای ${requestId} فرستاده شد ✅`,
      '',
      'ثبت‌کننده همین حالا آن را دید.',
    ].join('\n'),

  /**
   * تحویل شکست خورد.
   *
   * جدا از موفقیت گزارش می‌شود چون مدیر محصول باید بداند — تعهد پاسخ هنوز
   * نقض نشده ولی خودکار هم بسته نشده.
   */
  deliveryFailed: (requestId: string, reason: string) =>
    [
      `پاسخ ${requestId} نوشته و ذخیره شد، ولی به ثبت‌کننده نرسید.`,
      '',
      `علت: ${reason}`,
      '',
      'در صف می‌ماند و دوباره تلاش می‌شود.',
    ].join('\n'),

  cancelled: 'پاسخ لغو شد. چیزی فرستاده نشد.',

  deskHelp: [
    'میز تریاژ:',
    '/inbox — درخواست‌های بدون پاسخ',
    '',
    'خرابی‌های تازه خودکار برایت می‌آیند.',
  ].join('\n'),
} as const;

/** برچسب سرنوشت برای تأیید داخلی. */
export const outcomeFromChoice = (value: string): TriageOutcome | null => {
  const match = /^__outcome:(convert|merge|reject|need_data)$/.exec(value);
  return match === null ? null : (match[1] as TriageOutcome);
};

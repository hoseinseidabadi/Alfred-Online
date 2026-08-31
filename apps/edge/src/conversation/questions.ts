import type { RequestType, Unit } from '@alfred-online/contracts';

/**
 * پرسش‌های ثبت — FR-005 تا FR-012.
 *
 * متن پرسش‌ها **از منشور P-06 در مخزن دانش Alfred** می‌آید، نه از ذهن ما.
 * این تنها جای سامانه است که کاربر مستقیماً می‌خواندش، و منشور روی هر جمله‌اش
 * فکر شده. جایی که منشور متن نداشت (خرابی و بهبود)، از FR-006 و FR-007 با
 * همان لحن نوشته شد.
 *
 * سه قاعده که سرتاسر این فایل رعایت شده‌اند:
 *
 *   **FR-010** — هرجا مجموعهٔ پاسخ محدود است، گزینهٔ از پیش تعریف‌شده می‌آید.
 *     دو دلیل: ثبت سریع‌تر می‌شود، و پاسخ قابل تحلیل می‌ماند بدون اینکه کسی
 *     متن آزاد را دسته‌بندی کند.
 *
 *   **FR-012** — هیچ پرسش تخصصی. نه RICE، نه نفر-ماه، نه شدت، نه درصد
 *     اطمینان. منشور صریح است: پرسیدنشان «ثبت را می‌ترساند، و عددِ
 *     بی‌پشتوانه تولید می‌کند که بدتر از نداشتن عدد است.»
 *
 *   **اصل II** — مقدار ذخیره‌شده برای گزینه‌ها کلید پایدار است نه برچسب
 *     فارسی، چون برچسب ممکن است بازنویسی شود ولی معنا نباید عوض شود. برای
 *     پرسش‌های باز، عین متن کاربر می‌ماند.
 */

export interface Choice {
  /** مقدار پایدارِ ذخیره‌شده. هرگز عوض نمی‌شود. */
  value: string;
  /** آنچه کاربر می‌بیند. قابل بازنویسی بدون شکستن دادهٔ گذشته. */
  label: string;
}

export interface Question {
  /** کلید در `rawAnswers`. با قرارداد bridge-api یکی است. */
  key: string;
  prompt: string;
  /** اگر باشد، پاسخ محدود به همین‌هاست (FR-010). */
  choices?: Choice[];
  optional?: boolean;
}

// ── سوال صفر: واحد سازمانی ──────────────────────────────────────────────────

/**
 * فقط **یک بار** پرسیده می‌شود و برای همیشه می‌ماند (FR-003).
 * متن و گزینه‌ها عیناً از منشور P-06 بند ۲.۲.
 */
export const UNIT_QUESTION: Question = {
  key: 'unit',
  prompt: 'در کدام واحد کار می‌کنی؟',
  choices: [
    { value: 'editorial', label: 'تحریریه' },
    { value: 'technical', label: 'فنی' },
    { value: 'commercial', label: 'بازرگانی' },
    { value: 'management', label: 'مدیریت' },
    { value: 'other', label: 'سایر' },
  ],
};

// ── سوال نوع ────────────────────────────────────────────────────────────────

/** اولین پرسش پس از واحد — مجموعهٔ بعدی را همین تعیین می‌کند (FR-005). */
export const TYPE_QUESTION: Question = {
  key: 'requestType',
  prompt: 'چه چیزی می‌خواهی ثبت کنی؟',
  choices: [
    { value: 'bug', label: '🔴 یک چیزی خراب است' },
    { value: 'improvement', label: '🟡 چیزی هست ولی بهتر می‌شود' },
    { value: 'idea', label: '🟢 ایدهٔ تازه دارم' },
  ],
};

// ── خرابی — FR-006 ──────────────────────────────────────────────────────────

const BUG_QUESTIONS: Question[] = [
  {
    key: 'where',
    prompt: 'کجا دیدیش؟ (وب‌سایت، اپ، پنل مدیریت، یا هرجای دیگر)',
  },
  {
    key: 'action',
    prompt: 'داشتی چه کار می‌کردی؟ همان‌طور که برای یک همکار تعریف می‌کنی بنویس.',
  },
  {
    key: 'observed',
    prompt: 'چه شد، و انتظار داشتی چه بشود؟',
  },
  {
    key: 'since',
    prompt: 'از کِی این‌طور شده؟',
    choices: [
      { value: 'today', label: 'همین امروز' },
      { value: 'this_week', label: 'این هفته' },
      { value: 'this_month', label: 'این ماه' },
      { value: 'longer', label: 'خیلی وقت است' },
      { value: 'unknown', label: 'نمی‌دانم' },
    ],
  },
  {
    key: 'scope',
    prompt: 'به‌نظرت برای چند نفر پیش می‌آید؟',
    choices: [
      { value: 'just_me', label: 'فقط خودم' },
      { value: 'few_people', label: 'چند نفری' },
      { value: 'many', label: 'خیلی‌ها' },
      { value: 'everyone', label: 'همه' },
      { value: 'unknown', label: 'نمی‌دانم' },
    ],
  },
];

// ── بهبود — FR-007 ──────────────────────────────────────────────────────────

const IMPROVEMENT_QUESTIONS: Question[] = [
  {
    key: 'want',
    prompt: 'چه چیزی می‌خواهی؟ در یک جمله بگو.',
  },
  {
    key: 'surface',
    prompt: 'کدام بخش محصول را می‌گویی؟',
  },
  {
    key: 'current',
    prompt: 'الان چطور کار می‌کند؟',
  },
  {
    key: 'expected',
    prompt: 'اگر بهتر شود، چطور باید باشد؟',
  },
  {
    key: 'frequency',
    prompt: 'هر چند وقت به این برمی‌خوری؟',
    choices: [
      { value: 'daily', label: 'هر روز' },
      { value: 'weekly', label: 'هفته‌ای چند بار' },
      { value: 'monthly', label: 'ماهی چند بار' },
      { value: 'rarely', label: 'به‌ندرت' },
    ],
  },
];

// ── ایده — FR-008، عیناً از منشور P-06 بند ۲.۳ ─────────────────────────────

const IDEA_QUESTIONS: Question[] = [
  {
    key: 'oneLine',
    prompt: 'ایده‌ات را در یک جمله بگو.',
  },
  {
    key: 'targetUser',
    prompt: 'این ایده برای چه کسی است؟',
    choices: [
      { value: 'app_reader', label: 'خوانندهٔ اپ' },
      { value: 'editorial_colleague', label: 'همکار تحریریه' },
      { value: 'advertiser', label: 'آگهی‌دهنده' },
      { value: 'myself', label: 'خودم در کارم' },
      { value: 'other', label: 'سایر' },
    ],
  },
  {
    key: 'currentProblem',
    prompt: 'الان **بدون** این ایده، آن آدم چه می‌کند و چه مشکلی دارد؟',
  },
  {
    /**
     * منشور: «سوال ۴ کلید کل طراحی است. "درصد اطمینانت چقدر است؟" را هیچ
     * خبرنگاری جواب نمی‌دهد؛ "از کجا فهمیدی؟" را همه جواب می‌دهند.»
     *
     * پاسخ اینجا ورودی بُعد `confidence` است، ولی این تبدیل **در هسته و با
     * قاعدهٔ نسخه‌دار** انجام می‌شود (T049)، نه اینجا. ثبت‌کننده هرگز عدد
     * نمی‌بیند.
     */
    key: 'source',
    prompt: 'از کجا فهمیدی این مشکل هست؟',
    choices: [
      { value: 'user_said', label: 'کاربر مستقیم گفت / داده دیدم' },
      { value: 'saw_myself', label: 'خودم در کار روزانه دیدم' },
      { value: 'competitor_has', label: 'رقیب دارد' },
      { value: 'guessing', label: 'حدس می‌زنم' },
    ],
  },
  {
    key: 'successSign',
    prompt: 'اگر ساخته شود، چه چیزی باید عوض شود که بگویی موفق شد؟',
  },
  {
    /** ورودی بُعد `impact` — باز هم تبدیلش در هسته است، نه اینجا. */
    key: 'ifNotBuilt',
    prompt: 'اگر ساخته نشود چه اتفاقی می‌افتد؟',
    choices: [
      { value: 'nothing', label: 'هیچی' },
      { value: 'bit_harder', label: 'کمی سخت‌تر' },
      { value: 'work_blocked', label: 'کار زمین می‌ماند' },
    ],
  },
];

// ── سوال اختصاصی هر واحد — FR-009، منشور بند ۲.۴ ───────────────────────────

const ROLE_QUESTIONS: Record<Unit, string> = {
  editorial: 'این چه چیزی را در کار روزانهٔ تو یا تجربهٔ خواننده عوض می‌کند؟',
  commercial: 'آگهی‌دهندهٔ مشخصی این را خواسته؟ کدام؟',
  technical: 'کدام بخش سیستم را لمس می‌کند؟ چیزی الان خراب است که این حلش کند؟',
  management: 'این به کدام هدف امسال وصل است؟',
  other: 'چه کسی جز خودت از این سود می‌برد؟',
};

const QUESTIONS_BY_TYPE: Record<RequestType, Question[]> = {
  bug: BUG_QUESTIONS,
  improvement: IMPROVEMENT_QUESTIONS,
  idea: IDEA_QUESTIONS,
};

// ── API ─────────────────────────────────────────────────────────────────────

/** پرسش‌های مخصوص یک نوع درخواست، به‌ترتیب. */
export function questionsFor(type: RequestType): readonly Question[] {
  return QUESTIONS_BY_TYPE[type];
}

/** پرسش اختصاصی واحد سازمانی — همیشه آخرین پرسش محتوایی. */
export function roleQuestionFor(unit: Unit): Question {
  return { key: 'roleQuestion', prompt: ROLE_QUESTIONS[unit] };
}

/**
 * دنبالهٔ کامل پرسش‌های محتوایی: پرسش‌های نوع، سپس پرسش نقش.
 * پرسش واحد و نوع جدا هستند چون ماشین حالت آن‌ها را متفاوت مدیریت می‌کند.
 */
export function contentQuestions(type: RequestType, unit: Unit): readonly Question[] {
  return [...questionsFor(type), roleQuestionFor(unit)];
}

/** آیا این مقدار یکی از گزینه‌های مجاز آن پرسش است. */
export function isValidChoice(question: Question, value: string): boolean {
  if (question.choices === undefined) return value.trim().length > 0;
  return question.choices.some((choice) => choice.value === value);
}

# Implementation Plan: سامانهٔ ثبت و تصمیم‌گیری درخواست‌های محصول

**Branch**: `001-request-intake-triage` | **Date**: 2026-08-24 (۱۴۰۵/۰۶/۰۲) | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-request-intake-triage/spec.md`

## Summary

سامانه‌ای که درخواست‌های محصول (خرابی، بهبود، ایده) را از یک نقطهٔ ورود واحد در تلگرام می‌گیرد،
تعهد پاسخ مکتوب هفت‌روزه را تضمین می‌کند، و ظرفیت تک‌خطیِ توسعه را به‌گونه‌ای نمایش می‌دهد که
هزینهٔ فرصت هر تصمیم عددی و مرئی باشد.

رویکرد فنی: **دو محیط استقرار**. لایهٔ لبه روی Cloudflare Workers تمام تعامل با تلگرام را
انجام می‌دهد و **ثبت را به‌تنهایی تمام می‌کند** — شماره را خودش صادر می‌کند و در D1 بادوام
ذخیره می‌نماید. هستهٔ عملیاتی روی Liara (NestJS + PostgreSQL + Next.js) منبع حقیقت، تریاژ،
صف ظرفیت، مایلستون و داشبورد را دارد. پل میان این دو **ناپایدار فرض می‌شود** و تمام تماس‌ها
از سمت لبه آغاز می‌گردند، تا هسته هرگز تماس خروجی به خارج نگیرد.

## Technical Context

**Language/Version**: TypeScript 5.x — هر دو محیط

**Primary Dependencies**:

- لبه: Cloudflare Workers · Durable Objects (حالت گفت‌وگو، شمارنده) · D1 (صف دوطرفه) · Cron Triggers
- هسته: NestJS · PostgreSQL · Prisma · Next.js (داشبورد)
- مشترک: یک ماژول کوچک تبدیل تاریخ جلالی/تهران

**Storage**: PostgreSQL (هسته، منبع حقیقت عملیاتی) · D1 و Durable Object storage (لبه، حالت و صف)

**Testing**: Vitest برای هر دو؛ زمان اجرای محلی Workers برای آزمون‌های لبه؛ PostgreSQL واقعی
برای آزمون‌های یکپارچهٔ هسته. زمان تزریق‌شونده تا آزمون‌های مهلت و قطعی جهش زمانی داشته باشند.

**Target Platform**: Cloudflare Workers runtime (لبه) · Node.js روی Liara (هسته و داشبورد)

**Project Type**: Web — سه اپ در یک monorepo (edge / core / dashboard)

**Performance Goals**: مقیاس واقعی ~۳۰ تا ۵۰ ثبت در ماه. هیچ هدف توان عملیاتی معناداری وجود
ندارد. تنها قید تأخیرِ محسوس: پاسخ ربات به هر پیام کاربر باید فوری حس شود.

**Constraints**:

- ثبت MUST بدون دسترسی به هسته کامل شود؛ شماره در لبه صادر گردد
- قطعی پل MUST برای کاربر نامرئی بماند؛ صفر گم‌شدگی تا ۷۲ ساعت
- تمام رابط فارسی؛ تقویم جلالی و ساعت تهران در هر نمایش
- مخزن دانش فقط‌خواندنی؛ سامانه هرگز در آن نمی‌نویسد
- داشبورد MUST خروجی آفلاین‌خوان بدهد

**Scale/Scope**: ~۵۰ کاربر ثبت‌کننده · یک تریاژگر · حدود ده مدیر بیننده · ~۳۰۰ سند دانش ·
**یک دولوپر بک‌اند پاره‌وقت**

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

Source: `.specify/memory/constitution.md` v1.0.0

| #   | Gate                  | ارزیابی                                                                                                                                                      | Status   |
| --- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| I   | مرجعیت یک‌طرفهٔ دانش  | هیچ مؤلفه‌ای در مخزن دانش نمی‌نویسد. `KnowledgeRef` فقط ارجاع نگه می‌دارد نه محتوا. V-18 اثبات می‌کند سامانه با مخزن غیرقابل‌دسترس کار می‌کند.               | **PASS** |
| II  | دادهٔ خام دست‌نخورده  | `rawAnswers` تغییرناپذیر؛ `DerivedValue` جدا و حامل `ruleVersion`؛ `ExtractionRule` داده و نسخه‌دار؛ حذف رکورد ممنوع. قرارداد تریاژ `403 IMMUTABLE` می‌دهد.  | **PASS** |
| III | لبه خودکفاست          | شمارنده در Durable Object لبه؛ ثبت در D1 پیش از هر تماس با هسته؛ صف دوطرفه با idempotency؛ تمام تماس‌ها از سمت لبه.                                          | **PASS** |
| IV  | تعهد پاسخ             | `responseDueAt` مشتق‌شده؛ `atRisk` پیش از نقض؛ بستن بدون `respondedAt` ممنوع؛ `approvedBy` الزامی و `422 APPROVAL_REQUIRED`.                                 | **PASS** |
| V   | متریک و تاریخ بازبینی | `422 METRIC_AND_REVIEW_REQUIRED` و `EXACTLY_ONE_METRIC`؛ مسیر سریع پذیرفته ولی `incomplete` علامت می‌خورد و هرگز مسدود نمی‌شود؛ نرخ موفقیت به تفکیک `forum`. | **PASS** |
| VI  | مرزهای ماژول          | سه اپ مستقل: `apps/edge`، `apps/core`، `apps/dashboard`. ماژول‌های هسته: `intake` / `dashboard` / `reports`. ارتباط فقط از راه قرارداد.                      | **PASS** |
| VII | متناسب با مقیاس       | بدون جست‌وجوی برداری، بدون میکروسرویس، بدون احراز هویت سفارشی. D1 به‌جای صف اختصاصی. نشست ساده به‌جای SSO.                                                   | **PASS** |
| R   | تاب‌آوری و آزمون      | هر پنج آزمون الزامی به سناریوی اجرایی نگاشت شده (V-4، V-5، V-6، V-7، V-8) و SC-004 → V-11 با زمان جهش‌داده‌شده.                                              | **PASS** |
| L   | زبان و تقویم          | ذخیره UTC، نمایش جلالی/تهران؛ V-17 مقادیر تحلیلی داخلی را از دید ثبت‌کننده پنهان نگه می‌دارد.                                                                | **PASS** |
| S   | اسرار و دسترسی        | اسرار فقط در Secret Store؛ دسترسی از `getChatMember` مشتق می‌شود؛ نقش `viewer` فقط‌خواندنی.                                                                  | **PASS** |

**نتیجه**: ده گیت، همه PASS. جدول Complexity Tracking خالی است.

**بازارزیابی پس از فاز ۱**: طراحی دادهٔ فاز ۱ گیت‌ها را تقویت کرد، نه تضعیف — به‌ویژه II
(تفکیک `DerivedValue` از `rawAnswers`) و V (اعتبارسنجی‌های سطح قرارداد). هیچ گیتی تغییر نکرد.

## Project Structure

### Documentation (this feature)

```text
specs/001-request-intake-triage/
├── plan.md              # این فایل
├── spec.md              # ورودی
├── research.md          # فاز ۰ — سیزده تصمیم، دو spike
├── data-model.md        # فاز ۱
├── quickstart.md        # فاز ۱ — هجده سناریوی اعتبارسنجی
├── contracts/
│   ├── bridge-api.md    # لبه ⇄ هسته
│   └── triage-api.md    # تریاژ، تصمیم، گزارش
├── checklists/
│   └── requirements.md
└── tasks.md             # خروجی /speckit-tasks — هنوز ساخته نشده
```

### Source Code (repository root)

```text
apps/
├── edge/                       # Cloudflare Workers — رو به تلگرام
│   ├── src/
│   │   ├── webhook/            # ورودی تلگرام، اعتبارسنجی secret_token
│   │   ├── conversation/       # ماشین حالت + Durable Object
│   │   ├── counter/            # Durable Object شمارنده
│   │   ├── access/             # getChatMember + کش
│   │   ├── bridge/             # کلاینت outbox/inbox + Cron
│   │   └── telegram/           # destination adapter
│   ├── migrations/             # D1
│   └── tests/
│       ├── resilience/         # پنج آزمون الزامی + SC-004
│       └── unit/
│
├── core/                       # NestJS روی Liara — منبع حقیقت
│   ├── src/
│   │   ├── modules/
│   │   │   ├── intake/         # Request, Submitter, Response, ExtractionRule
│   │   │   ├── dashboard/      # QueueItem, Milestone, snapshot
│   │   │   └── reports/        # ReportPeriod, funnel, success rate
│   │   ├── bridge/             # پیاده‌سازی bridge-api
│   │   └── triage/             # پیاده‌سازی triage-api
│   ├── prisma/
│   └── tests/
│
└── dashboard/                  # Next.js — سه طبقه + خروجی آفلاین
    ├── src/
    └── tests/

packages/
├── jalali/                     # تبدیل تاریخ، مشترک هر سه اپ
└── contracts/                  # تایپ‌های مشترک قراردادها
```

**Structure Decision**: monorepo با سه اپ مستقل، چون اصل VI مرزهای ماژول را از روز اول الزام
می‌کند و این «اولین جزء از سامانه‌ای است که داشبوردهای گزارش دیگری هم می‌گیرد». دو محیط استقرار
متفاوت (Workers و Node) هرچه باشد جدایی فیزیکی `edge` از `core` را اجتناب‌ناپذیر می‌کند؛ monorepo
اجازه می‌دهد `packages/contracts` تایپ‌ها را بین آن‌ها مشترک نگه دارد و از واگرایی قرارداد جلوگیری کند.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

هیچ تخطی‌ای وجود ندارد. جدول عمداً خالی است.

## Phase Status

| فاز             | خروجی                                                                                            | وضعیت                                   |
| --------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------- |
| ۰ — پژوهش       | [research.md](./research.md) — R-01 تا R-13                                                      | ✅ کامل، بدون `NEEDS CLARIFICATION` باز |
| ۱ — طراحی       | [data-model.md](./data-model.md) · [contracts/](./contracts/) · [quickstart.md](./quickstart.md) | ✅ کامل                                 |
| ۱ — زمینهٔ عامل | `CLAUDE.md` ریشهٔ پروژه                                                                          | ✅ به‌روز شد                            |
| ۲ — وظایف       | `tasks.md`                                                                                       | ⏳ با `/speckit-tasks`                  |

## کارهای مسدودکنندهٔ پیش از پیاده‌سازی

| #   | کار                                                       | نوع                  |
| --- | --------------------------------------------------------- | -------------------- |
| S-1 | تأیید ادمین بودن ربات در کانال و پاسخ‌دهی `getChatMember` | فنی — مسدودکننده     |
| S-2 | اندازه‌گیری یک‌هفته‌ای پایداری مسیر Cloudflare → Liara    | فنی — تنظیم‌کننده    |
| S-3 | فاز ۰ دستی P-06 و تصویب سازمانی تعهد هفت‌روزه             | سازمانی — مسدودکننده |

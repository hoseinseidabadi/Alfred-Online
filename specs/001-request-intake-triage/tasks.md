---
description: 'Task list — سامانهٔ ثبت و تصمیم‌گیری درخواست‌های محصول'
---

# Tasks: سامانهٔ ثبت و تصمیم‌گیری درخواست‌های محصول

**Feature**: `001-request-intake-triage` · **Date**: 2026-08-30 (۱۴۰۵/۰۶/۰۸)

**Input**: [plan.md](./plan.md) · [spec.md](./spec.md) · [research.md](./research.md) ·
[data-model.md](./data-model.md) · [contracts/](./contracts/) · [quickstart.md](./quickstart.md) ·
[constitution v1.0.0](../../.specify/memory/constitution.md)

---

## دربارهٔ این فهرست

**آزمون‌ها اختیاری نیستند.** قانون اساسی (بخش «تاب‌آوری و آزمون») پنج آزمون تاب‌آوری را
الزام کرده و SC-004 صراحتاً آزمون **اجراشدنی** می‌خواهد. این شش مورد در فهرست زیر
**وظیفهٔ مستقل و صریح**‌اند، نه زیرمجموعهٔ کار دیگری، و هرکدام به سناریوی متناظرش در
`quickstart.md` گره خورده‌اند.

**نشانه‌گذاری `[P]` عمداً استفاده نشده.** ظرفیت اجرا **یک دولوپر بک‌اند پاره‌وقت** است
(اصل VII و Technical Context برنامه). موازی‌سازی در این مقیاس خیال است؛ به‌جای آن یک
**ترتیب خطی واقع‌بینانه** آمده و هرجا وابستگی واقعی وجود ندارد، در انتهای همان فاز
یک یادداشت کوتاه گفته است چه چیزی را می‌شود جابه‌جا کرد.

**قراردادها اول.** در هر فاز، پیاده‌سازی سمت **عرضه‌کنندهٔ** قرارداد (هستهٔ Liara) پیش از
**مصرف‌کننده‌اش** (لبه، ابزار تریاژ، داشبورد) می‌آید. این ترتیب عمدی است: تایپ‌های
`packages/contracts` باید پیش از هر دو سمت تثبیت شده باشند تا قرارداد واگرا نشود.

**واحد تخمین**: «روز کاری معادل» با فرض **حدود دو روز کاری در هفته**. تخمین‌ها در سطح فاز
داده شده‌اند نه تک‌وظیفه، چون در این مقیاس دقت تک‌وظیفه‌ای ادعای دروغینی است.

### قالب

`- [ ] [TaskID] [Story?] شرح، با مسیر دقیق فایل`

- `[Story]` فقط در فازهای داستان کاربر می‌آید (US1 … US5).
- ✅ در ابتدای شرح یعنی **آزمون الزامی قانون اساسی** — شکستش شکست گیت است، نه یک تست قرمز قابل چشم‌پوشی.

---

## Phase 0: مسدودکننده‌های پیش از کدنویسی

**Purpose**: سه چیزی که اگر بسته نشوند، کد نوشتن یا بی‌فایده است یا بر پایهٔ فرض غلط.

**✅ T001 بسته شد (۱۴۰۵/۰۶/۰۸)** — مکانیزم روی کانال تستی تأیید شد؛ **R-05 معتبر است و
بازطراحی لازم نیست**. مسدودکنندهٔ سخت برداشته شده.

- [x] T001 **S-1** — تأیید ادمین بودن ربات و پاسخ‌دهی `getChatMember` روی کانال؛ نتیجه در `specs/001-request-intake-triage/spikes/S-1-channel-membership.md` — **یافتهٔ تعیین‌کننده**: کاربر غیرعضو `ok: true` با `status: "left"` می‌گیرد، نه خطا؛ پس «غیرعضو» از «تلگرام خراب است» قابل تفکیک است. صفر محدودیت نرخ در ۳۰ فراخوانی پشت‌سرهم. تأیید روی **کانال واقعی محصول** به بند ۱ چک‌لیست T109 منتقل شد
- [ ] T002 **S-2** — اندازه‌گیری یک‌هفته‌ای پایداری مسیر Cloudflare → Liara (نرخ موفقیت، تأخیر صدک ۵۰ و ۹۵، الگو و طول قطعی‌ها)؛ ثبت اعداد در `specs/001-request-intake-triage/spikes/S-2-bridge-stability.md` و به‌روزرسانی «پیش‌فرض هر ۲ دقیقه» در R-04 — **خروجی این وظیفه مقدار `crons` در `apps/edge/wrangler.toml` (T007) و انتظار تأخیر در T044 را تعیین می‌کند**
- [ ] T003 **S-3** — اجرای دو هفته فاز ۰ دستیِ فرآیند P-06 (پرسش‌ها و تعهد هفت‌روزه به‌صورت دستی) و اخذ تصویب سازمانی؛ ثبت شواهد و تصمیم در `specs/001-request-intake-triage/spikes/S-3-p06-adoption.md` — **سازمانی است، نه فنی: موازی با کدنویسی پیش می‌رود و آن را متوقف نمی‌کند، ولی استقرار بهره‌برداری را بله**

**Checkpoint**: T001 بسته شده. T002 عدد Cron را داده. T003 در جریان است و می‌تواند تا پایان فاز ۳ ادامه یابد.

**تخمین**: T001 نیم روز · T002 یک روز پراکنده در یک هفتهٔ تقویمی · T003 دو هفتهٔ تقویمی سازمانی (بدون مصرف ظرفیت دولوپر).

---

## Phase 1: Setup — اسکلت monorepo

**Purpose**: سه اپ و دو پکیج مشترک، با یک خط CI که از روز اول آزمون‌های الزامی را گیت می‌کند.

- [x] T004 ساخت اسکلت monorepo با npm workspaces (`apps/*`, `packages/*`) در `package.json` ریشه، به‌همراه `tsconfig.base.json` و `.gitignore` (شامل `.env` و `.dev.vars`)
- [x] T005 پیکربندی lint و format در `eslint.config.mjs` و `.prettierrc` ریشه
- [x] T006 پیکربندی Vitest در `vitest.config.ts` ریشه (فایل `vitest.workspace.ts` در Vitest 4 منسوخ شده؛ جایش `test.projects`) و اسکریپت‌های `test` و `test:resilience` در `package.json` — گیت الزامی از راه `scripts/check-resilience-tests.mjs` بسته می‌شود تا نبودِ شش آزمون بی‌صدا از CI رد نشود
- [x] T007 اسکلت اپ لبه در `apps/edge/package.json`، `apps/edge/wrangler.toml` (binding های D1، دو Durable Object، و `crons` با مقدار خروجی T002) و `apps/edge/src/index.ts`، به‌همراه `apps/edge/.dev.vars.example` با `TELEGRAM_TOKEN`، `WEBHOOK_SECRET`، `BRIDGE_KEY`، `CORE_URL`
- [x] T008 اسکلت هستهٔ NestJS در `apps/core/package.json`، `apps/core/src/main.ts`، `apps/core/src/app.module.ts` و `apps/core/.env.example` با `DATABASE_URL`، `BRIDGE_KEY`، `SESSION_SECRET`
- [x] T009 اسکلت داشبورد Next.js در `apps/dashboard/package.json` و `apps/dashboard/src/app/layout.tsx` با `lang="fa"` و `dir="rtl"`
- [x] T010 خط CI در `.github/workflows/ci.yml` که `npm test` و `npm run test:resilience` را **هر دو به‌عنوان گیت مسدودکننده** اجرا کند

**✅ فاز ۱ بسته شد (۱۴۰۵/۰۶/۰۹)** — `typecheck`، `lint`، `format` و `test` هر چهار سبز.
`test:resilience` **عمداً قرمز است**: شش آزمون الزامی هنوز نوشته نشده‌اند و نگهبان
`scripts/check-resilience-tests.mjs` این را صریح گزارش می‌کند به‌جای اینکه بی‌صدا رد شود.

**تخمین فاز**: ~۳ روز کاری معادل.

---

## Phase 2: Foundational — پیش‌نیازهای مسدودکنندهٔ همهٔ داستان‌ها

**Purpose**: تایپ‌های قرارداد، ماژول تاریخ، شمای داده و دو نگهبان امنیتی. **هیچ داستان کاربری
پیش از کامل شدن این فاز شروع نمی‌شود.**

- [x] T011 ماژول تاریخ در `packages/jalali/src/index.ts` — تبدیل UTC به جلالی و ساعت تهران، قالب‌بندی تاریخ و ساعت، و محاسبهٔ اختلاف روز؛ **هیچ تابعی که تاریخ میلادی به بیرون بدهد صادر نشود** (R-07)
- [x] T012 آزمون ماژول تاریخ در `packages/jalali/tests/jalali.test.ts` — سال کبیسهٔ جلالی، مرز نیمه‌شب تهران، آفست ثابت `+03:30`، و اختلاف هفت‌روزه
- [x] T013 تایپ‌های bridge-api در `packages/contracts/src/bridge.ts` — هر پنج نقطهٔ تماس [contracts/bridge-api.md](./contracts/bridge-api.md)
- [x] T014 تایپ‌های triage-api در `packages/contracts/src/triage.ts` — هر شش نقطهٔ تماس [contracts/triage-api.md](./contracts/triage-api.md)
- [x] T015 enum کدهای خطای قرارداد در `packages/contracts/src/errors.ts` — `REJECT_INCOMPLETE`، `APPROVAL_REQUIRED`، `SERVICE_REF_REQUIRED`، `MERGE_TARGET_REQUIRED`، `METRIC_AND_REVIEW_REQUIRED`، `EXACTLY_ONE_METRIC`، `MIN_THREE_CARDS`، `IMMUTABLE`
- [x] T016 شمای Prisma برای همهٔ موجودیت‌های بخش «ب» [data-model.md](./data-model.md) در `apps/core/prisma/schema.prisma` — `Request`، `Submitter`، `Response`، `ExtractionRule`، `DerivedValue`، `QueueItem`، `Milestone`، `Decision`، `CouncilSession`، `AuditEntry`، `ReportPeriod`
- [x] T017 مهاجرت اولیه در `apps/core/prisma/migrations/0001_init/migration.sql` با **سیاست بدون حذف** — بدون `ON DELETE CASCADE` و بدون هیچ مسیر `DELETE` (ناوردای ۹، FR-027)
- [x] T018 نویسندهٔ سابقه در `apps/core/src/common/audit.service.ts` — هر تغییر `type`، `isCritical`، `position` و `status` یک ردیف `AuditEntry` می‌سازد
- [x] T019 نشست و نقش‌ها در `apps/core/src/auth/session.module.ts` و `apps/core/src/auth/roles.guard.ts` — دو نقش `product` (خواندن و نوشتن) و `viewer` (فقط‌خواندنی)، مطابق R-08
- [x] T020 نگهبان پل در `apps/core/src/bridge/bridge-key.guard.ts` — هدر `X-Bridge-Key`؛ هر تماس بدون آن `401`
- [x] T021 مهاجرت D1 لبه در `apps/edge/migrations/0001_init.sql` — جدول‌های `EdgeSubmission` و `OutboundResponse` با کلید اصلی `requestId` و `responseId` (پایهٔ idempotency)
- [x] T022 راستی‌آزمایی webhook در `apps/edge/src/webhook/verify.ts` — تطبیق هدر `X-Telegram-Bot-Api-Secret-Token` با راز Secret Store (R-06)

**Checkpoint**: شما و تایپ‌ها تثبیت شده‌اند؛ هر دو محیط بالا می‌آیند و مهاجرت‌ها اجرا می‌شوند.

**وابستگی واقعی ندارند**: T011 و T012 (ماژول تاریخ) از T013–T015 (تایپ‌های قرارداد) و از T016 و T017 (شما) مستقل‌اند — ترتیبشان دلخواه است.

**تخمین فاز**: ~۷ روز کاری معادل.

---

## Phase 3: User Story 1 — ثبت بدون اصطکاک و بدون گم‌شدن (P1) 🎯 MVP

**Goal**: هر کارمند عضو کانال، در کمتر از سه دقیقه ثبت می‌کند، شمارهٔ پایدار `REQ-NNN` می‌گیرد،
و تعهد هفت‌روزه را به تاریخ جلالی می‌بیند — **حتی وقتی هسته کاملاً خاموش است**.

**Independent Test**: یک ثبت کامل انجام بده و شماره بگیر؛ سپس با هستهٔ روشن بررسی کن که همان
رکورد با `rawAnswers` عیناً فارسی در PostgreSQL هست. سپس هسته را خاموش کن و دوباره ثبت کن —
تجربهٔ کاربر **هیچ تفاوتی نمی‌کند**.

**چرا این به‌تنهایی تحویل‌پذیر است**: با پایان این فاز سازمان برای اولین بار می‌داند چند
درخواست، از کدام واحدها و با چه محتوایی دارد. تریاژ هنوز دستی است (فاز ۰ دستیِ T003 ادامه
می‌یابد) ولی **هیچ ثبتی گم نمی‌شود** — و همین تنها چیزی است که MVP باید ثابت کند.

### ۳-الف) هسته — عرضه‌کنندهٔ bridge-api (پیش از مصرف‌کننده)

- [x] T023 [US1] سرویس مهلت در `apps/core/src/modules/intake/deadline.service.ts` — محاسبهٔ `responseDueAt = submittedAt + 7d` و مشتق کردن `atRisk` **پیش از** نقض، با ساعت تزریق‌شونده (اصل IV، FR-030)
- [x] T024 [US1] ✅ **آزمون الزامی ۵ — هشدار پیش از نقض تعهد** در `apps/core/tests/resilience/v8-deadline-warning.test.ts`؛ سناریوی **V-8** در `quickstart.md`: درخواستی با `submittedAt` شش روز پیش MUST قبل از رسیدن به روز هفتم `atRisk = true` بدهد. زمان کنترل‌شده، مطابق R-12
- [ ] T025 [US1] سرویس ثبت‌کننده در `apps/core/src/modules/intake/submitter.service.ts` — upsert روی `chatId`، نگه‌داشت `unit` و `accessStatus`، شمارش `requestCount`
- [ ] T026 [US1] سرویس درخواست در `apps/core/src/modules/intake/request.service.ts` — درج `Request` با `source = bot`، `originalType`، و `rawAnswers` **بدون هیچ نرمال‌سازی یا خلاصه‌سازی** (اصل II، ناوردای ۱)
- [ ] T027 [US1] نقطهٔ تماس `POST /bridge/submissions` در `apps/core/src/bridge/bridge.controller.ts` — idempotent روی `requestId`، **حفظ ترتیب `submittedAt`**، پاسخ `{ accepted, rejected }`، و ادامهٔ پردازش بقیه در صورت رد شدن یک قلم
- [ ] T028 [US1] نقطهٔ تماس `GET /bridge/health` در `apps/core/src/bridge/bridge.controller.ts` و ذخیرهٔ آمار معطل‌های دو جهت که لبه با هر تماس Cron می‌فرستد (FR-019 — نمایشش در T077)
- [ ] T029 [US1] نقطهٔ تماس اختیاری `GET /bridge/access/{chatId}` در `apps/core/src/bridge/access.controller.ts` — فقط استثناهای دستی (FR-002)؛ در دسترس نبودنش MUST ثبت را متوقف نکند
- [ ] T030 [US1] آزمون قرارداد در `apps/core/tests/contract/bridge-submissions.test.ts` — idempotency، حفظ ترتیب، و اینکه هسته `rawAnswers` را دست نمی‌زند

### ۳-ب) لبه — شماره و گفت‌وگو

- [x] T031 [US1] شمارندهٔ سراسری در `apps/edge/src/counter/counter.do.ts` — Durable Object یکتا، صدور اتمیک `REQ-{n}` با `lastNumber` پایدار (R-03، FR-016)
- [x] T032 [US1] ✅ **آزمون الزامی ۲ — یکتایی شماره پس از بازراه‌اندازی** در `apps/edge/tests/resilience/v7-counter-uniqueness.test.ts`؛ سناریوی **V-7**: چند ثبت هم‌زمان به‌علاوهٔ بازراه‌اندازی شبیه‌سازی‌شدهٔ لبه MUST نه شمارهٔ تکراری بدهد نه شکاف پرش‌دار
- [ ] T033 [US1] بررسی عضویت در `apps/edge/src/access/membership.ts` — نگاشت **قطعیِ** تأییدشده در [S-1](./spikes/S-1-channel-membership.md): `creator`/`administrator`/`member` → مجاز · `left`/`kicked`/`restricted` و `400 member not found` → رد · `429`/`5xx`/خطای شبکه/timeout → **نامعلوم**، مسیر جداگانه با سقوط به استثنای T029 و **هرگز تفسیر به «رد»**؛ کش کوتاه‌مدت در Durable Object کاربر **فقط برای دو حالت قطعی** — حالت «نامعلوم» MUST NOT کش شود (R-05، FR-001)
- [x] T034 [US1] سه مجموعه پرسش در `apps/edge/src/conversation/questions.ts` — خرابی (FR-006)، بهبود (FR-007)، ایده (FR-008)، به‌علاوهٔ پرسش متناسب با واحد سازمانی (FR-009)؛ همه فارسی، با گزینهٔ از پیش تعریف‌شده هرجا مجموعهٔ پاسخ محدود است (FR-010) و **بدون هیچ پرسش تخصصی** (FR-012)
- [x] T035 [US1] ماشین حالت در `apps/edge/src/conversation/state-machine.ts` — گذارهای `idle → askUnit?* → askType → askQ1..Qn → askRoleQ → askAttachment → confirm → submitted`؛ `askUnit` فقط وقتی `unit` خالی است (FR-003)
- [x] T036 [US1] شیء گفت‌وگو در `apps/edge/src/conversation/conversation.do.ts` — نگه‌داشت `ConversationState`، انقضای ۲۴ ساعتِ بی‌فعالیتی با انتخاب ادامه یا شروع تازه (FR-013)، دستور لغو، و **تأیید گرفتن** هنگام شروع ثبت تازه وسط گفت‌وگوی باز
- [x] T037 [US1] ✅ **آزمون الزامی ۴ — بقای گفت‌وگوی نیمه‌تمام** در `apps/edge/tests/resilience/v6-conversation-survival.test.ts`؛ سناریوی **V-6**: بازراه‌اندازی لبه وسط سوال سوم MUST کاربر را از **همان سوال** ادامه دهد
- [ ] T038 [US1] پیوست اختیاری در `apps/edge/src/conversation/attachments.ts` — تصویر، فایل و پیوند؛ پیوست بزرگ یا نامعتبر پیام روشن می‌گیرد و **ثبت بدون پیوست کامل می‌شود** (FR-011)
- [ ] T039 [US1] آداپتور مقصد در `apps/edge/src/telegram/adapter.ts` و رجیستری در `apps/edge/src/telegram/registry.ts` — الگوی بازاستفاده‌شده از Campaign Studio؛ منطق ثبت MUST به تلگرام گره نخورد (R-13)
- [ ] T040 [US1] مسیریاب webhook در `apps/edge/src/webhook/router.ts` — اتصال ورودی راستی‌آزمایی‌شدهٔ T022 به شیء گفت‌وگوی کاربر

### ۳-پ) لبه — ثبت بادوام و پل خروجی

- [ ] T041 [US1] ثبت بادوام در `apps/edge/src/submission/persist.ts` — صدور شماره از T031، نوشتن `EdgeSubmission` در D1 **پیش از هر تماس با هسته**، سپس ارسال پیام تأیید حاوی `REQ-NNN` و مهلت هفت‌روزه به **تاریخ جلالی** با `packages/jalali` (اصل III، FR-015)
- [ ] T042 [US1] ✅ **آزمون الزامی ۱ — تکمیل ثبت با هستهٔ در دسترس نبودن** در `apps/edge/tests/resilience/v4-submit-core-down.test.ts`؛ سناریوی **V-4**: با هستهٔ ساختگیِ خطاده، شماره صادر می‌شود، کاربر هیچ تفاوتی حس نمی‌کند، و رکورد در D1 با `deliveredToCoreAt = null` می‌ماند
- [ ] T043 [US1] کلاینت صف خروجی در `apps/edge/src/bridge/outbox.ts` — ارسال تحویل‌نشده‌ها به `POST /bridge/submissions` **به‌ترتیب `submittedAt`**، idempotency با `requestId`، عقب‌نشینی نمایی، افزایش `deliveryAttempts` و ثبت `lastError`؛ **هیچ رکوردی حذف نمی‌شود**
- [ ] T044 [US1] زمان‌بند در `apps/edge/src/bridge/cron.ts` — اجرای دوره‌ای با فاصلهٔ تعیین‌شده در T002، به‌علاوهٔ ارسال آمار معطل‌ها به T028
- [ ] T045 [US1] ✅ **آزمون الزامی ۳ — تحویل صف پس از بازگشت ارتباط** در `apps/edge/tests/resilience/v5-queue-drain.test.ts`؛ سناریوی **V-5**: سه ثبت با هستهٔ خاموش، سپس روشن کردن و یک چرخهٔ Cron → هر سه **به‌ترتیب زمانی** و بدون تکرار؛ اجرای دوبارهٔ Cron MUST هیچ رکورد تکراری نسازد
- [ ] T046 [US1] ✅ **SC-004 — قطعی ۷۲ ساعته، صفر گم‌شدگی** در `apps/edge/tests/resilience/v11-72h-outage.test.ts`؛ سناریوی **V-11** با زمان جهش‌داده‌شده: ۷۲ ساعت قطعی، N ثبت در طول آن، سپس اتصال → `N` رسیده، صفر گم‌شده، ترتیب حفظ‌شده، صفر تکراری
- [ ] T047 [US1] آزمون یکپارچهٔ مسیر کامل در `apps/edge/tests/integration/v1-full-submission.test.ts` — سناریوهای **V-1** (شماره، تعهد، و `rawAnswers` عیناً فارسی) و **V-2** (واحد سازمانی بار دوم پرسیده نمی‌شود)
- [ ] T048 [US1] آزمون غیرعضو در `apps/edge/tests/integration/v3-non-member.test.ts` — سناریوی **V-3**: ثبت انجام نمی‌شود، پیام راهنمای عضویت می‌آید، و تلاش برای سابقه ثبت می‌گردد

**Checkpoint 🎯 MVP**: ثبت سرتاسری کار می‌کند. پنج آزمون علامت‌خوردهٔ ✅ این فاز سبزند
(V-4، V-5، V-6، V-7، V-8) به‌علاوهٔ SC-004 / V-11. اینجا می‌شود **ایستاد، اعتبارسنجی کرد و
تحویل داد** — تریاژ همچنان دستی و بر پایهٔ خروجی هسته انجام می‌شود.

**وابستگی واقعی ندارند**: T023 و T024 (سرویس مهلت و آزمونش) هیچ ارتباطی با کار لبه ندارند و هرجای این فاز می‌توانند بنشینند. T034 (متن پرسش‌ها) کار نوشتاری است و می‌تواند در فاصله‌های انتظار انجام شود. T039 (آداپتور) پیش از T040 لازم است ولی از T031–T033 مستقل است.

**تخمین فاز**: ~۱۸ روز کاری معادل (≈ ۹ هفته با ظرفیت دو روز در هفته).

---

## Phase 4: User Story 2 — تریاژ و تعهد پاسخ هفت‌روزه (P2)

**Goal**: مدیر محصول در نشست هفتگی همهٔ درخواست‌های باز را با پاسخ‌های خام می‌بیند، یکی از
چهار سرنوشت را انتخاب می‌کند، و پاسخ تأییدشده **خودکار** به ثبت‌کننده می‌رسد — حتی اگر پل
در لحظهٔ تأیید قطع باشد.

**Independent Test**: پنج درخواست ثبت کن؛ یک نشست تریاژ برگزار کن؛ هر پنج ثبت‌کننده پاسخ
مکتوب گرفته‌اند و زمان پاسخ همه زیر هفت روز است.

> **دو مقدار موقتاً تهی می‌مانند**: `queueSnapshot` در بستهٔ تریاژ و `displaced` در پاسخ
> تصمیم به صف ظرفیت (US4) نیاز دارند که هنوز ساخته نشده. در این فاز قرارداد **رعایت
> می‌شود** — هر دو کلید همیشه برمی‌گردند، با مقدار تهی — و T093 و T094 در فاز ۶ آن‌ها را
> پر می‌کنند. این عمدی است، نه فراموشی.

### ۴-الف) هسته — عرضه‌کنندهٔ triage-api (پیش از مصرف‌کننده)

- [ ] T049 [US2] قواعد استخراج نسخه‌دار در `apps/core/src/modules/intake/extraction-rule.service.ts` و دادهٔ اولیه در `apps/core/prisma/seed/extraction-rules.ts` — نگاشت پاسخ انسانی به `confidence` و `severity` و `impact` **به‌صورت داده، نه کد** (اصل II، R-11، FR-025)
- [ ] T050 [US2] مقادیر استخراج‌شده در `apps/core/src/modules/intake/derived-value.service.ts` — هر `DerivedValue` حامل `ruleVersion` و **جدا از `rawAnswers`**، با امکان `overriddenBy` (ناوردای ۲، FR-026)
- [ ] T051 [US2] نقطهٔ تماس `GET /api/triage/batch` در `apps/core/src/triage/batch.controller.ts` — `rawAnswers` عیناً، `responseDueAt`، `daysRemaining`، پیوست‌ها، `extractionRules`، و کلید همیشه‌حاضر `queueSnapshot`
- [ ] T052 [US2] درخواست‌های مشابه در `apps/core/src/triage/similar.service.ts` — تطبیق کلیدواژه‌ای در مقیاس چند ده رکورد؛ **MUST NOT ادغام خودکار انجام دهد** (اصل VII: بدون جست‌وجوی برداری)
- [ ] T053 [US2] پیشنهاد سرویس در `apps/core/src/triage/knowledge-ref.service.ts` — `suggestedServiceRef` از فرادادهٔ **فقط‌خواندنیِ** مخزن دانش؛ فقط `KnowledgeRef` نگه داشته می‌شود، هرگز محتوا (اصل I، FR-032، FR-052)
- [ ] T054 [US2] اتصال `atRisk` به بستهٔ تریاژ در `apps/core/src/triage/batch.controller.ts` — مصرف سرویس مهلت T023 (FR-030)
- [ ] T055 [US2] نقطهٔ تماس `POST /api/triage/{requestId}/decide` در `apps/core/src/triage/decide.controller.ts` — چهار سرنوشت `convert` و `merge` و `reject` و `need_data`، ثبت `serviceRef` و `isCritical`، و کلید همیشه‌حاضر `displaced` (FR-028)

### ۴-ب) اعتبارسنجی‌های قرارداد — هرکدام وظیفهٔ مستقل

> این‌ها همان چیزی هستند که اصل IV و V را از شعار به کد تبدیل می‌کنند. هیچ‌کدام
> زیرمجموعهٔ T055 نیست.

- [ ] T056 [US2] `422 REJECT_INCOMPLETE` در `apps/core/src/triage/validators/reject-incomplete.validator.ts` — `outcome = reject` بدون هر یک از سه بخش «چه فهمیدیم» و «چرا الان نه» و «در چه شرایطی بله» رد می‌شود (FR-031، ناوردای ۵)
- [ ] T057 [US2] `422 APPROVAL_REQUIRED` در `apps/core/src/triage/validators/approval-required.validator.ts` — `response.approvedBy` خالی یعنی رد؛ **هیچ پاسخی بدون تأیید انسان ارسال نمی‌شود** (اصل IV، FR-033)
- [ ] T058 [US2] `422 SERVICE_REF_REQUIRED` در `apps/core/src/triage/validators/service-ref-required.validator.ts` — `serviceRef` خالی و بدون مقدار صریح `"unknown"` رد می‌شود (FR-022، SC-009)
- [ ] T059 [US2] `422 MERGE_TARGET_REQUIRED` در `apps/core/src/triage/validators/merge-target-required.validator.ts` — `outcome = merge` بدون `mergedInto` رد می‌شود
- [ ] T060 [US2] `403 IMMUTABLE` در `apps/core/src/modules/intake/raw-answers.guard.ts` — هر تلاش برای تغییر `rawAnswers` پس از درج رد می‌شود (اصل II، ناوردای ۱، FR-024)
- [ ] T061 [US2] آزمون قرارداد اعتبارسنجی‌ها در `apps/core/tests/contract/triage-validators.test.ts` — یک مورد مثبت و یک مورد منفی به‌ازای **هر پنج** کد بالا

### ۴-پ) پاسخ و مسیر برگشت به کاربر

- [ ] T062 [US2] تغییر نوع بدون تغییر شماره در `apps/core/src/triage/type-change.service.ts` و آزمونش در `apps/core/tests/integration/v10-type-change.test.ts` — سناریوی **V-10**: `id` ثابت می‌ماند و یک ردیف `AuditEntry` ساخته می‌شود (FR-021، ناوردای ۳)
- [ ] T063 [US2] سرویس پاسخ در `apps/core/src/modules/intake/response.service.ts` — تولید `RSP-NNNN`، سه‌بخشی بودن اجباری برای `kind = reject`، ثبت `approvedBy` و `approvedAt`، و امکان ویرایش متن پیش از تأیید (FR-033)
- [ ] T064 [US2] نقطه‌های تماس `GET /bridge/outbound` و `POST /bridge/outbound/ack` در `apps/core/src/bridge/outbound.controller.ts` — فقط پاسخ‌های دارای `approvedBy` بیرون می‌آیند؛ تا نرسیدن ack همان پاسخ دوباره برگردانده می‌شود؛ `deliveredAt` فقط با ack پر می‌گردد
- [ ] T065 [US2] مصرف‌کنندهٔ صف ورودی در `apps/edge/src/bridge/inbox.ts` — کشیدن پاسخ‌ها در همان چرخهٔ Cron (T044)، ارسال با آداپتور T039 **بدون هیچ بازنویسی یا خلاصه‌سازی متن**، سپس ack؛ idempotent روی `responseId` (FR-018)
- [ ] T066 [US2] نگهبان بستن در `apps/core/src/modules/intake/close.guard.ts` — `Request` MUST NOT به `closed` برود مگر `respondedAt` مقدار داشته باشد (اصل IV، ناوردای ۴، FR-029)
- [ ] T067 [US2] استعلام وضعیت با شماره در `apps/core/src/modules/intake/status.controller.ts` و `apps/edge/src/conversation/status-query.ts` — کاربر شمارهٔ پیگیری می‌دهد و وضعیت را به زبان فارسی و تاریخ جلالی می‌گیرد؛ **هیچ عدد تحلیلی داخلی نمایش داده نمی‌شود** (FR-035، FR-012)
- [ ] T068 [US2] آزمون یکپارچهٔ چرخهٔ تریاژ در `apps/core/tests/integration/v9-triage-cycle.test.ts` — سناریوی **V-9**: بستهٔ تریاژ، دو رد `422`، تصمیم کامل، و تحویل `RSP-NNNN` پس از یک چرخه

**Checkpoint**: تعهد هفت‌روزه سرتاسری بسته شد. US1 و US2 هر دو مستقلاً کار می‌کنند.

**وابستگی واقعی ندارند**: T056–T060 (پنج اعتبارسنج) هر پنج به فایل‌های جدا می‌روند و هیچ‌کدام به دیگری وابسته نیست — ترتیبشان کاملاً دلخواه است. T049 و T050 (قواعد استخراج) از مسیر پاسخ (T063–T065) مستقل‌اند.

**تخمین فاز**: ~۱۲ روز کاری معادل (≈ ۶ هفته).

---

## Phase 5: User Story 3 — داشبورد شفاف برای جلسهٔ مدیران (P3)

**Goal**: یک صفحه که در سی ثانیه سه پرسش مدیر را جواب می‌دهد، به‌علاوهٔ عمق بحث، عمق عملیاتی،
و یک خروجی آفلاین که سند رسمی همان جلسه است.

**Independent Test**: مدیری که صفحه را ندیده، بدون راهنمایی و زیر سی ثانیه می‌گوید چند مورد
بحرانی باز است، قدیمی‌ترین چند روزه است، و آیا از تعهد عقبیم.

> **چرا `POST /api/decisions` اینجاست و نه در US5**: قاعدهٔ حداقل سه کارت (FR-039) و الزام
> متریک و تاریخ بازبینی (FR-040) هر دو به **جلسهٔ تصمیم** تعلق دارند و `quickstart.md`
> سناریوی V-13 را صریحاً به US3 نگاشته. US5 بعداً فقط **استثنای مسیر سریع** را روی همین
> نقطهٔ تماس اضافه می‌کند، نه یک نقطهٔ تماس تازه.

- [ ] T069 [US3] سرویس دورهٔ گزارش در `apps/core/src/modules/reports/period.service.ts` — قیف `submitted → evaluated → executed`، `avgResponseDays`، `slaBreaches`، `unitDiversity` (FR-051، SC-007، SC-008)
- [ ] T070 [US3] نقطهٔ تماس `GET /api/reports/period` در `apps/core/src/modules/reports/reports.controller.ts`
- [ ] T071 [US3] سرویس خلاصه در `apps/core/src/modules/dashboard/summary.service.ts` — تعداد خرابی بحرانی باز و عمر قدیمی‌ترین، تعداد باز به تفکیک نوع، ظرفیت موجود، میانگین زمان پاسخ در برابر تعهد، قیف دوره، و تعداد مایلستون در خطر (FR-046)
- [ ] T072 [US3] نقطهٔ تماس `GET /api/dashboard/summary` در `apps/core/src/modules/dashboard/dashboard.controller.ts`
- [ ] T073 [US3] عمق اول در `apps/dashboard/src/app/page.tsx` — شش عدد FR-046 در یک نگاه، فارسی و جلالی
- [ ] T074 [US3] عمق دوم در `apps/dashboard/src/app/discuss/page.tsx` — خرابی‌های بحرانی **تک‌تک** با نام، عمر و دامنهٔ اثر (FR-047)، و هر کارت در انتظار تصمیم همراه با آنچه تأییدش عقب می‌اندازد (FR-049)
- [ ] T075 [US3] قاعدهٔ تجمیع در `apps/core/src/modules/dashboard/aggregation.ts` — خرابی‌های **غیربحرانی** MUST NOT در عمق اول و دوم تک‌تک ظاهر شوند (FR-048)
- [ ] T076 [US3] عمق سوم در `apps/dashboard/src/app/operations/page.tsx` — فهرست کامل عملیاتی برای کار روزانهٔ واحد محصول
- [ ] T077 [US3] نمایش سلامت پل در `apps/dashboard/src/components/BridgeHealth.tsx` — وضعیت مسیر و تعداد اقلام معطل در هر جهت، از دادهٔ T028 (FR-019)
- [ ] T078 [US3] تولید snapshot در `apps/core/src/modules/dashboard/snapshot.service.ts` — یک فایل HTML **خودبسنده** با CSS و داده درون‌خطی و **صفر درخواست بیرونی** (R-09، FR-050)
- [ ] T079 [US3] نقطهٔ تماس `POST /api/dashboard/snapshot` در `apps/core/src/modules/dashboard/snapshot.controller.ts`
- [ ] T080 [US3] جلسهٔ تصمیم در `apps/core/src/modules/dashboard/council-session.service.ts` — موجودیت `CouncilSession` با `cardsPresented` و `snapshotPath`
- [ ] T081 [US3] نقطهٔ تماس `POST /api/decisions` در `apps/core/src/modules/dashboard/decision.controller.ts` — شالودهٔ مشترک `council` و `fast_track`، ثبت `Decision` با `outcome` و `successMetric` و `reviewDate` و `displaced`
- [ ] T082 [US3] `422 MIN_THREE_CARDS` در `apps/core/src/modules/dashboard/validators/min-three-cards.validator.ts` — `forum = council` با کمتر از سه کارت رد می‌شود؛ سامانه MUST NOT جلسهٔ تک‌کارتی را تشکیل‌شده ثبت کند (FR-039، ناوردای ۸)
- [ ] T083 [US3] `422 METRIC_AND_REVIEW_REQUIRED` در `apps/core/src/modules/dashboard/validators/metric-and-review-required.validator.ts` — `outcome = execute` بدون `successMetric` یا `reviewDate` رد می‌شود (اصل V، FR-040)
- [ ] T084 [US3] `422 EXACTLY_ONE_METRIC` در `apps/core/src/modules/dashboard/validators/exactly-one-metric.validator.ts` — بیش از یک متریک رد می‌شود (اصل V، ناوردای ۶)
- [ ] T085 [US3] فقط‌خواندنی بودن مدیران در `apps/dashboard/src/middleware.ts` — نقش `viewer` هیچ مسیر نوشتنی نمی‌بیند و هیچ فراخوانی نوشتنی از او پذیرفته نمی‌شود (R-08)
- [ ] T086 [US3] آزمون قاعدهٔ سه کارت در `apps/core/tests/contract/v13-min-three-cards.test.ts` — سناریوی **V-13**: جلسه با دو کارت → `422 MIN_THREE_CARDS`
- [ ] T087 [US3] آزمون سی‌ثانیه در `apps/dashboard/tests/v15-thirty-seconds.test.ts` — سناریوی **V-15**: سه پرسش مدیر MUST از عمق اول و بدون پیمایش قابل استخراج باشند (بررسی ساختاری؛ مشاهدهٔ انسانی جداگانه در چک‌لیست پیش از استقرار)
- [ ] T088 [US3] آزمون خروجی آفلاین در `apps/dashboard/tests/v16-offline-snapshot.test.ts` — سناریوی **V-16**: فایل snapshot با شبکهٔ قطع همان محتوا را می‌دهد و **صفر درخواست بیرونی** می‌زند

**Checkpoint**: جلسهٔ مدیران روی سطح مشترک برگزار می‌شود؛ US1 و US2 و US3 هر سه مستقل‌اند.

**وابستگی واقعی ندارند**: T080–T084 (تصمیم و سه اعتبارسنجش) از T069–T079 (گزارش و داشبورد) مستقل است؛ اگر جلسهٔ تصمیم زودتر لازم شد، می‌شود اول آن را برداشت.

**تخمین فاز**: ~۱۲ روز کاری معادل (≈ ۶ هفته).

---

## Phase 6: User Story 4 — صف ظرفیت و مایلستون: هزینهٔ فرصت مرئی (P4)

**Goal**: صف تک‌خطی با تخمین و ترتیب؛ هر درج یا جابه‌جایی **دقیقاً** می‌گوید چه چیزی و
چقدر عقب افتاد، و کدام مایلستون به خطر افتاد.

**Independent Test**: آیتمی را در موقعیت ۱ درج کن؛ سامانه فهرست آیتم‌های عقب‌افتاده، روزهای
تأخیر هرکدام، و مایلستون‌های متأثر با دلیل قابل ردیابی را برمی‌گرداند.

- [ ] T089 [US4] سرویس صف در `apps/core/src/modules/dashboard/queue.service.ts` — `QueueItem` با `position` یکتا و پیوسته؛ ناوردای **حداکثر یک آیتم `in_progress`** به‌صورت قید پایگاه داده و کد (FR-036، ناوردای ۷)
- [ ] T090 [US4] محاسبهٔ جابه‌جایی در `apps/core/src/modules/dashboard/displacement.service.ts` — درج یا جابه‌جایی MUST فهرست `{ requestId, delayDays }` تولید کند (FR-037، SC-005)
- [ ] T091 [US4] محاسبهٔ ظرفیت در `apps/core/src/modules/dashboard/capacity.service.ts` — `freeCapacityDays`؛ آیتم بدون `estimateDays` «تخمین‌نشده» علامت می‌خورد و **در محاسبه وارد نمی‌شود**
- [ ] T092 [US4] مایلستون در `apps/core/src/modules/dashboard/milestone.service.ts` — `status` **مشتق‌شده از وابستگی‌ها، نه دستی**، و `riskReason` اشاره‌کننده به آیتم مسبب (FR-038)
- [ ] T093 [US4] پر کردن `queueSnapshot` در `apps/core/src/triage/batch.controller.ts` — جایگزینی مقدار تهی فاز ۴ با تصویر واقعی صف و ظرفیت آزاد
- [ ] T094 [US4] پر کردن `displaced` در `apps/core/src/triage/decide.controller.ts` و `apps/core/src/modules/dashboard/decision.controller.ts` — مصرف T090؛ **همیشه برمی‌گردد، حتی خالی**، تا هزینهٔ فرصت هرگز نامرئی نماند
- [ ] T095 [US4] نمای صف و مایلستون در `apps/dashboard/src/app/queue/page.tsx` — ترتیب، بازهٔ زمانی هر آیتم، ظرفیت آزاد، تخمین‌نشده‌ها، و مایلستون‌های در خطر با دلیل
- [ ] T096 [US4] آزمون هزینهٔ فرصت در `apps/core/tests/integration/v12-displacement.test.ts` — سناریوی **V-12**: درج در موقعیت ۱ → `displaced` درست، و مایلستون وابسته `at_risk` با `riskReason` اشاره‌کننده به همان آیتم

**Checkpoint**: تصمیم از «بله/خیر» به «به قیمت چه چیزی؟» تبدیل شد.

**وابستگی واقعی ندارند**: T092 (مایلستون) پس از T089 می‌آید ولی از T090 و T091 مستقل است.

**تخمین فاز**: ~۷ روز کاری معادل (≈ ۳.۵ هفته).

---

## Phase 7: User Story 5 — مسیر سریع مدیرعامل، با متریک و بازبینی (P5)

**Goal**: دستور مستقیم هیچ‌وقت متوقف نمی‌شود، ولی نامرئی هم نمی‌ماند: ظرف ۴۸ ساعت سه فیلد
الزامی می‌شود، در تاریخ بازبینی یادآوری می‌آید، و نرخ موفقیتش **جدا** گزارش می‌شود.

**Independent Test**: آیتمی از مسیر سریع ثبت کن؛ بلافاصله `in_progress` می‌شود، پس از ۴۸
ساعت در فهرست هشدار ناقص‌ها ظاهر می‌گردد، و در تاریخ بازبینی یادآوری تولید می‌شود.

- [ ] T097 [US5] استثنای مسیر سریع در `apps/core/src/modules/dashboard/decision.controller.ts` — `forum = fast_track` MUST **بدون** `successMetric` و `reviewDate` هم پذیرفته شود، آیتم بلافاصله `in_progress` گردد، و رکورد `incomplete` علامت بخورد؛ سه اعتبارسنج T082–T084 برای این مسیر **دور زده می‌شوند، نه حذف** (اصل V، FR-042، FR-043)
- [ ] T098 [US5] فهرست هشدار ناقص‌ها در `apps/core/src/modules/dashboard/incomplete-alert.service.ts` — تصمیم `fast_track` که پس از ۴۸ ساعت هر سه فیلد را کامل نکرده هشدار می‌دهد؛ **اجرا هرگز مسدود نمی‌شود**
- [ ] T099 [US5] نمایش هشدارها در `apps/dashboard/src/app/discuss/page.tsx` — فهرست ناقص‌های مسیر سریع در عمق دوم
- [ ] T100 [US5] نقطهٔ تماس `POST /api/decisions/{id}/review` در `apps/core/src/modules/dashboard/review.controller.ts` — ثبت `reviewOutcome` (`worked` یا `did_not_work` یا `inconclusive`) و `reviewedAt`
- [ ] T101 [US5] یادآور بازبینی در `apps/core/src/modules/dashboard/review-reminder.service.ts` — در `reviewDate` یادآوری تولید می‌شود (FR-041)
- [ ] T102 [US5] گزارش تفکیکی در `apps/core/src/modules/reports/period.service.ts` — افزودن `fastTrackShare` و `successRateByForum` به `GET /api/reports/period` (FR-044، SC-006، SC-010)
- [ ] T103 [US5] آزمون مسیر سریع در `apps/core/tests/integration/v14-fast-track.test.ts` — سناریوی **V-14**: تصمیم `fast_track` بدون متریک **پذیرفته** و `incomplete` علامت می‌خورد و پس از ۴۸ ساعت هشدار می‌دهد؛ همان درخواست با `forum = council` و بدون متریک → `422 METRIC_AND_REVIEW_REQUIRED`

**Checkpoint**: هر پنج داستان کاربر مستقلاً کار می‌کنند.

**تخمین فاز**: ~۵ روز کاری معادل (≈ ۲.۵ هفته).

---

## Phase 8: Polish & Cross-Cutting

**Purpose**: دو ناوردای سراسری که به هیچ داستانی تعلق ندارند ولی هر دو گیت قانون اساسی‌اند، به‌علاوهٔ کارهای تحویل.

- [ ] T104 آزمون زبان و تقویم در `apps/dashboard/tests/v17-language-calendar.test.ts` و `apps/edge/tests/unit/v17-messages.test.ts` — سناریوی **V-17**: هر صفحه و هر پیام فارسی، جلالی و ساعت تهران؛ **هیچ تاریخ میلادی و هیچ عدد تحلیلی داخلی (امتیاز، شدت، اطمینان) به ثبت‌کننده نشان داده نمی‌شود**
- [ ] T105 آزمون فقط‌خواندنی بودن مخزن دانش در `apps/core/tests/integration/v18-knowledge-readonly.test.ts` — سناریوی **V-18**: کل چرخه با مخزن **غیرقابل‌دسترس** اجرا می‌شود و ثبت و پاسخ‌گویی کار می‌کند؛ و `git status` مخزن پس از یک چرخهٔ کامل **دست‌نخورده** است (اصل I، FR-055)
- [ ] T106 دادهٔ نمونه در `apps/core/prisma/seed/seed.ts` و اسکریپت `npm run seed` — چند درخواست، یک صف و دو مایلستون، تا داشبورد در توسعه خالی نباشد
- [ ] T107 مستندسازی اسرار در `docs/secrets.md` — نگاشت هر راز به Secret Store محیط خودش؛ راستی‌آزمایی اینکه `.env` و `.dev.vars` در `.gitignore`‌اند و هیچ رازی در تاریخچهٔ گیت نیست
- [ ] T108 به‌روزرسانی `CLAUDE.md` ریشه و `README.md` — مسیر اجرا، مرز سه اپ، و اینکه مخزن دانش کجاست و چرا هرگز نوشته نمی‌شود
- [ ] T109 اجرای چک‌لیست پیش از استقرار [quickstart.md](./quickstart.md) — هر هشت بند، با ثبت نتیجه در `specs/001-request-intake-triage/spikes/pre-deploy-checklist.md`

**تخمین فاز**: ~۵ روز کاری معادل.

---

## ردیابی آزمون‌های الزامی

| #      | آزمون الزامی قانون اساسی             | سناریوی quickstart | وظیفه | فایل                                                          |
| ------ | ------------------------------------ | ------------------ | ----- | ------------------------------------------------------------- |
| ۱      | تکمیل ثبت با هستهٔ در دسترس نبودن    | **V-4**            | T042  | `apps/edge/tests/resilience/v4-submit-core-down.test.ts`      |
| ۲      | یکتایی شماره پس از بازراه‌اندازی لبه | **V-7**            | T032  | `apps/edge/tests/resilience/v7-counter-uniqueness.test.ts`    |
| ۳      | تحویل صف پس از بازگشت ارتباط         | **V-5**            | T045  | `apps/edge/tests/resilience/v5-queue-drain.test.ts`           |
| ۴      | بقای گفت‌وگوی نیمه‌تمام              | **V-6**            | T037  | `apps/edge/tests/resilience/v6-conversation-survival.test.ts` |
| ۵      | هشدار پیش از نقض تعهد                | **V-8**            | T024  | `apps/core/tests/resilience/v8-deadline-warning.test.ts`      |
| SC-004 | قطعی ۷۲ ساعته، صفر گم‌شدگی           | **V-11**           | T046  | `apps/edge/tests/resilience/v11-72h-outage.test.ts`           |

هر شش مورد در `npm run test:resilience` و در گیت CI (T010) اجرا می‌شوند. **شکست هرکدام شکست
گیت است، نه یک تست قرمز قابل چشم‌پوشی.**

---

## ردیابی اعتبارسنجی‌های قرارداد

| کد                                                                                 | وظیفه | اصل / الزام                 |
| ---------------------------------------------------------------------------------- | ----- | --------------------------- |
| `422 REJECT_INCOMPLETE`                                                            | T056  | اصل IV · FR-031 · ناوردای ۵ |
| `422 APPROVAL_REQUIRED`                                                            | T057  | اصل IV · FR-033             |
| `422 SERVICE_REF_REQUIRED`                                                         | T058  | FR-022 · SC-009             |
| `422 MERGE_TARGET_REQUIRED`                                                        | T059  | FR-028                      |
| `403 IMMUTABLE`                                                                    | T060  | اصل II · ناوردای ۱ · FR-024 |
| `422 MIN_THREE_CARDS`                                                              | T082  | FR-039 · ناوردای ۸          |
| `422 METRIC_AND_REVIEW_REQUIRED`                                                   | T083  | اصل V · FR-040              |
| `422 EXACTLY_ONE_METRIC`                                                           | T084  | اصل V · ناوردای ۶           |
| **استثنای مسیر سریع** — پذیرش بدون متریک، علامت `incomplete`، بدون مسدود کردن اجرا | T097  | اصل V · FR-042 · FR-043     |

---

## Dependencies & Execution Order

### وابستگی فازها

```text
Phase 0 (T001 مسدودکنندهٔ سخت)
   └─> Phase 1 Setup ─> Phase 2 Foundational
                            └─> Phase 3 US1  🎯 MVP — اینجا می‌شود ایستاد و تحویل داد
                                   └─> Phase 4 US2
                                          └─> Phase 5 US3
                                                 └─> Phase 6 US4
                                                        └─> Phase 7 US5
                                                               └─> Phase 8 Polish
```

- **T003 (S-3)** موازی پیش می‌رود و کدنویسی را متوقف نمی‌کند، ولی **بهره‌برداری** را بله.
- **T002 (S-2)** پیش از T007 لازم است، چون مقدار `crons` را می‌دهد.

### وابستگی داستان‌ها

- **US1 (P1)**: پس از فاز ۲ شروع می‌شود. به هیچ داستان دیگری وابسته نیست. **به‌تنهایی تحویل‌پذیر است.**
- **US2 (P2)**: به `Request` و مسیر پل US1 وابسته است (T026، T043، T044).
- **US3 (P3)**: به دادهٔ US2 وابسته است — پاسخ، مهلت، و سرنوشت تریاژ.
- **US4 (P4)**: به `Decision` و `Request` وابسته است؛ دو کلید تهیِ فاز ۴ را در T093 و T094 پر می‌کند.
- **US5 (P5)**: به نقطهٔ تماس `POST /api/decisions` از US3 (T081) و به صف US4 (T089) وابسته است.

### ترتیب درون هر فاز

قرارداد ← عرضه‌کننده (هسته) ← مصرف‌کننده (لبه یا داشبورد) ← آزمون سناریو.
آزمون‌های الزامی بلافاصله پس از جزئی که می‌سنجند می‌آیند، نه در انتها — تا اگر جزء غلط
ساخته شد، همان هفته معلوم شود نه سه ماه بعد.

### دربارهٔ موازی‌سازی

ظرفیت اجرا **یک دولوپر بک‌اند پاره‌وقت** است (اصل VII). فهرست بالا یک **ترتیب خطی** است و
باید خطی خوانده شود. تنها چهار جای فهرست وابستگی واقعی ندارند و ترتیبشان دلخواه است:

| کجا   | چه چیزی                                                                    |
| ----- | -------------------------------------------------------------------------- |
| فاز ۲ | ماژول تاریخ (T011 و T012) از تایپ‌های قرارداد و شمای داده مستقل است        |
| فاز ۳ | سرویس مهلت و آزمون V-8 (T023 و T024) از کل کار لبه مستقل است               |
| فاز ۴ | پنج اعتبارسنج (T056–T060) هر پنج در فایل جدا، بدون وابستگی متقابل          |
| فاز ۵ | تصمیم و سه اعتبارسنجش (T080–T084) از گزارش و داشبورد (T069–T079) مستقل است |

جای دیگری «موازی» نوشتن با این ظرفیت، خودفریبی برنامه‌ریزی است.

---

## Implementation Strategy

### MVP اول — فقط US1

1. فاز ۰ را ببند (**T001 مسدودکنندهٔ سخت**).
2. فاز ۱ و ۲ را کامل کن.
3. فاز ۳ (US1) را تمام کن.
4. **بایست و اعتبارسنجی کن**: V-1، V-2، V-3، و شش آزمون علامت‌خوردهٔ ✅ باید سبز باشند.
5. تحویل بده. تریاژ همچنان دستی است — و همین کافی است، چون تعهد هفت‌روزه در فاز ۰ دستی
   (T003) در حال اجراست و **هیچ ثبتی گم نمی‌شود**.

### تحویل افزایشی

| گام           | چه چیزی به دست می‌آید                   | تخمین تجمعی            |
| ------------- | --------------------------------------- | ---------------------- |
| فاز ۰–۳       | ثبت سرتاسری، شمارهٔ پایدار، صفر گم‌شدگی | ~۲۸ روز کاری ≈ ۱۴ هفته |
| + فاز ۴ (US2) | تعهد پاسخ هفت‌روزه بسته می‌شود          | ~۴۰ روز ≈ ۲۰ هفته      |
| + فاز ۵ (US3) | جلسهٔ مدیران روی سطح مشترک              | ~۵۲ روز ≈ ۲۶ هفته      |
| + فاز ۶ (US4) | هزینهٔ فرصت مرئی می‌شود                 | ~۵۹ روز ≈ ۳۰ هفته      |
| + فاز ۷ (US5) | کانال غیررسمی رسمی می‌شود               | ~۶۴ روز ≈ ۳۲ هفته      |
| + فاز ۸       | آمادهٔ استقرار                          | ~۶۹ روز ≈ ۳۵ هفته      |

**فرض تخمین**: حدود دو روز کاری در هفته، یک نفر. اگر ظرفیت عوض شد، این جدول باید بازنویسی
شود — نه اینکه وظایف «موازی» اعلام شوند.

---

## Notes

- بدون `[P]`: ترتیب خطی است، به‌جز چهار مورد جدول «دربارهٔ موازی‌سازی».
- برچسب `[Story]` برای ردیابی هر وظیفه به داستان کاربرش است؛ فازهای Setup و Foundational و Polish برچسب ندارند.
- پس از هر وظیفه یا گروه منطقی commit بزن.
- در هر Checkpoint می‌شود ایستاد و داستان را مستقل اعتبارسنجی کرد.
- **هیچ رکوردی حذف نمی‌شود** — نه در لبه، نه در هسته، نه در آزمون‌ها (ناوردای ۹).
- **هیچ‌چیز در مخزن دانش نوشته نمی‌شود** — نه در کد، نه در اسکریپت، نه در seed (اصل I).

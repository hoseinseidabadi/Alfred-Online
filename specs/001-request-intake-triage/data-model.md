# Phase 1 — Data Model

**Feature**: `001-request-intake-triage` · **Date**: 2026-08-24 (۱۴۰۵/۰۶/۰۲)
**Input**: [spec.md](./spec.md) · [research.md](./research.md) · [constitution v1.0.0](../../.specify/memory/constitution.md)

داده در دو محل زندگی می‌کند و این تفکیک عمدی است (اصل III):

| محل                            | چه چیزی                                                       | چرا                          |
| ------------------------------ | ------------------------------------------------------------- | ---------------------------- |
| **لبه** (D1 + Durable Objects) | حالت گفت‌وگو، شمارنده، صف دوطرفه                              | باید بدون هسته کار کند       |
| **هسته** (PostgreSQL)          | منبع حقیقت عملیاتی — درخواست، پاسخ، صف ظرفیت، مایلستون، تصمیم | مصرف‌کننده‌اش داخل ایران است |

> هیچ موجودیتی در هر دو سمت «منبع حقیقت» نیست. لبه پس از تحویل موفق، فقط رونوشت بایگانی نگه می‌دارد.

---

## الف) موجودیت‌های لبه

### `ConversationState` — Durable Object، یکی به‌ازای هر کاربر

| فیلد                                  | نوع             | توضیح                                                 |
| ------------------------------------- | --------------- | ----------------------------------------------------- |
| `chatId`                              | شناسه           | کلید شیء                                              |
| `unit`                                | enum?           | واحد سازمانی — **یک بار پرسیده، برای همیشه** (FR-003) |
| `step`                                | enum            | گام جاری ماشین حالت                                   |
| `requestType`                         | enum?           | `bug` \| `improvement` \| `idea`                      |
| `answers`                             | map             | پاسخ‌های جمع‌آوری‌شده تا این لحظه، عین متن            |
| `attachments`                         | list            | ارجاع پیوست‌ها                                        |
| `startedAt`, `lastActivityAt`         | timestamp       | برای انقضای ۲۴ ساعته (FR-013)                         |
| `membershipCheckedAt`, `membershipOk` | timestamp, bool | کش کوتاه‌مدت نتیجهٔ R-05                              |

**گذارهای حالت**: `idle → askUnit?* → askType → askQ1..Qn → askRoleQ → askAttachment → confirm → submitted`
(`askUnit` فقط اگر `unit` خالی باشد.)

**قواعد**:

- بازراه‌اندازی سرویس MUST حالت را حفظ کند (FR-014، آزمون الزامی ۴).
- بی‌فعالیتی بیش از ۲۴ ساعت → گفت‌وگو منقضی؛ کاربر بین ادامه یا شروع تازه انتخاب می‌کند.
- شروع ثبت تازه حین گفت‌وگوی باز MUST از کاربر تأیید بگیرد، نه اینکه بی‌صدا جایگزین کند.

### `RequestCounter` — Durable Object، سراسری و یکتا

| فیلد         | نوع     |
| ------------ | ------- |
| `lastNumber` | integer |

صدور اتمیک `REQ-{n}`. یکتایی MUST در برابر بازراه‌اندازی حفظ شود (آزمون الزامی ۲).

### `EdgeSubmission` — D1

رونوشت بادوام هر ثبت، از لحظهٔ صدور شماره.

| فیلد                              | نوع             | توضیح                                    |
| --------------------------------- | --------------- | ---------------------------------------- |
| `requestId`                       | text, PK        | `REQ-NNN`                                |
| `chatId`, `submitterName`, `unit` | —               | هویت ثبت‌کننده                           |
| `requestType`                     | enum            | حدس ثبت‌کننده                            |
| `rawAnswers`                      | json            | **عین متن فارسی — تغییرناپذیر** (اصل II) |
| `attachments`                     | json            | ارجاع‌ها                                 |
| `submittedAt`                     | timestamp (UTC) | مبدأ محاسبهٔ مهلت هفت‌روزه               |
| `deliveredToCoreAt`               | timestamp?      | خالی = هنوز در صف خروجی                  |
| `deliveryAttempts`, `lastError`   | integer, text?  | برای FR-019                              |

### `OutboundResponse` — D1

پاسخ‌هایی که از هسته گرفته شده‌اند و باید به کاربر برسند.

| فیلد                                | نوع                        |
| ----------------------------------- | -------------------------- |
| `responseId`                        | text, PK (idempotency key) |
| `requestId`, `chatId`               | —                          |
| `body`                              | text                       |
| `fetchedFromCoreAt`, `sentToUserAt` | timestamp / timestamp?     |
| `sendAttempts`, `lastError`         | integer, text?             |

**قاعدهٔ مشترک صف**: تحویل MUST به‌ترتیب `submittedAt` باشد و با `requestId` / `responseId`
idempotent بماند؛ تلاش مجدد نباید رکورد تکراری بسازد (FR-017، FR-018).

---

## ب) موجودیت‌های هسته

### `Request` — درخواست

| فیلد                                                      | نوع        | قواعد                                                                               |
| --------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------- |
| `id`                                                      | text, PK   | `REQ-NNN`، صادرشده در لبه، **هرگز تغییر نمی‌کند** (FR-020)                          |
| `type`                                                    | enum       | `bug` \| `improvement` \| `idea` — **قابل تغییر در تریاژ بدون تغییر `id`** (FR-021) |
| `originalType`                                            | enum       | حدس اولیهٔ ثبت‌کننده؛ برای سنجش نرخ دسته‌بندی اشتباه                                |
| `submitterId`, `unit`                                     | fk, enum   |                                                                                     |
| `rawAnswers`                                              | jsonb      | **تغییرناپذیر پس از درج** (اصل II، FR-024)                                          |
| `serviceRef`                                              | text       | ارجاع به سرویس مخزن دانش، یا `unknown` — الزامی (FR-022، SC-009)                    |
| `status`                                                  | enum       | `new` \| `triaged` \| `queued` \| `in_progress` \| `answered` \| `closed`           |
| `triageOutcome`                                           | enum?      | `convert` \| `merge` \| `reject` \| `need_data` (FR-028)                            |
| `mergedInto`                                              | fk?        | اگر `merge`                                                                         |
| `promotedRef`                                             | text?      | شناسهٔ دوم پس از ارتقا به ایده (FR-023)                                             |
| `isCritical`                                              | bool       | **فقط در تریاژ تعیین می‌شود، نه توسط ثبت‌کننده**                                    |
| `submittedAt`, `responseDueAt`, `respondedAt`, `closedAt` | timestamps | `responseDueAt = submittedAt + 7d`                                                  |
| `source`                                                  | enum       | `bot` \| `fast_track` \| `manual`                                                   |

**قواعد**:

- MUST NOT حذف شود، حتی پس از رد (FR-027).
- MUST NOT به `closed` برود مگر `respondedAt` مقدار داشته باشد (FR-029، SC-009).
- `type` عوض شود → `id` ثابت؛ تاریخچهٔ تغییر در `AuditEntry`.

### `Submitter` — ثبت‌کننده

`id` · `chatId` · `displayName` · `unit` · `accessStatus` (`member` \| `exception` \| `revoked`) ·
`firstSeenAt` · `requestCount`

### `Response` — پاسخ

| فیلد                                                | نوع                                                            |
| --------------------------------------------------- | -------------------------------------------------------------- |
| `id`, `requestId`                                   | —                                                              |
| `kind`                                              | `convert` \| `merge` \| `reject` \| `need_data`                |
| `body`                                              | text                                                           |
| `rejectUnderstood`, `rejectWhyNot`, `rejectWhenYes` | text? — **هر سه الزامی وقتی `kind = reject`** (FR-031)         |
| `approvedBy`, `approvedAt`                          | **الزامی — هیچ پاسخی بدون تأیید انسان ارسال نمی‌شود** (FR-033) |
| `handedToEdgeAt`, `deliveredAt`                     | timestamp?                                                     |

### `ExtractionRule` — قاعدهٔ استخراج

| فیلد                            | نوع                                    |
| ------------------------------- | -------------------------------------- |
| `id`, `version`                 | —                                      |
| `dimension`                     | `confidence` \| `severity` \| `impact` |
| `mapping`                       | jsonb — پاسخ انسانی → مقدار            |
| `effectiveFrom`, `supersededBy` | —                                      |

### `DerivedValue` — مقدار استخراج‌شده

`requestId` · `dimension` · `value` · `ruleVersion` · `derivedAt` · `overriddenBy?`

> **جدا از `rawAnswers` و هرگز جایگزین آن نمی‌شود.** هر مقدار به قاعده‌ای که تولیدش کرده قابل
> ردیابی است (اصل II، FR-025، FR-026).

### `QueueItem` — آیتم صف ظرفیت

`id` · `requestId` · `position` (یکتا، پیوسته) · `estimateDays?` · `startedAt?` · `completedAt?` ·
`isFastTrack`

**قواعد**: صف **تک‌خطی** است — هم‌زمان حداکثر یک آیتم `in_progress` (FR-036).
آیتم بدون `estimateDays` در محاسبهٔ ظرفیت وارد نمی‌شود و «تخمین‌نشده» علامت می‌خورد.
درج یا جابه‌جایی MUST فهرست آیتم‌های عقب‌افتاده و میزان تأخیر را تولید کند (FR-037).

### `Milestone` — مایلستون

`id` · `title` · `targetDate` · `status` (`on_track` \| `at_risk` \| `done`) ·
`dependsOnQueueItems` (list) · `riskReason?`

**قاعده**: `status` MUST از وابستگی‌ها مشتق شود، نه دستی — و `riskReason` MUST به آیتم مسبب
اشاره کند (FR-038).

### `Decision` — تصمیم

| فیلد                          | نوع                             | قواعد                                                     |
| ----------------------------- | ------------------------------- | --------------------------------------------------------- |
| `id`, `requestId`             | —                               |                                                           |
| `forum`                       | `council` \| `fast_track`       |                                                           |
| `outcome`                     | `execute` \| `park` \| `reject` |                                                           |
| `successMetric`               | text                            | **الزامی وقتی `outcome = execute` — دقیقاً یکی** (FR-040) |
| `reviewDate`                  | date                            | **الزامی وقتی `outcome = execute`**                       |
| `displaced`                   | list                            | چه چیزی از صف عقب افتاد                                   |
| `decidedAt`, `decidedBy`      | —                               |                                                           |
| `reviewOutcome`, `reviewedAt` | enum?, timestamp?               | `worked` \| `did_not_work` \| `inconclusive`              |

**قواعد**:

- `forum = fast_track` MUST ظرف ۴۸ ساعت هر سه فیلد را کامل کند، ولی MUST NOT اجرا را متوقف کند
  (FR-042، FR-043).
- نرخ موفقیت MUST به تفکیک `forum` قابل محاسبه باشد (FR-044).

### `CouncilSession` — جلسهٔ تصمیم

`id` · `heldAt` · `cardsPresented` (list) · `snapshotPath?`

**قاعده**: `count(cardsPresented) >= 3` — سامانه MUST NOT جلسه‌ای با کمتر از سه کارت را
تشکیل‌شده ثبت کند (FR-039).

### `AuditEntry` — سابقه

`id` · `entity`, `entityId` · `field` · `oldValue`, `newValue` · `actor` · `at`

هر تغییر `type`، `isCritical`، `position` و `status` MUST ثبت شود.

### `ReportPeriod` — دورهٔ گزارش

`id` · `from`, `to` · شمارش‌های قیف · `avgResponseDays` · `fastTrackShare` ·
`successRateByForum`

---

## پ) موجودیت خارجی — فقط‌خواندنی

### `KnowledgeRef`

ارجاع سبک به مخزن دانش: `kind` (`service` \| `process` \| `event` \| `idea`) · `ref` · `title`.

> سامانه MUST NOT محتوای مخزن دانش را کپی یا ذخیره کند — فقط ارجاع (اصل I، FR-052).
> عنوان صرفاً برای نمایش کش می‌شود و منبع حقیقت نیست.

---

## ت) ناوردایی‌های سراسری

| #   | ناوردا                                                                       | منشأ           |
| --- | ---------------------------------------------------------------------------- | -------------- |
| ۱   | `rawAnswers` پس از درج تغییر نمی‌کند                                         | اصل II         |
| ۲   | هر `DerivedValue` یک `ruleVersion` دارد                                      | اصل II         |
| ۳   | `Request.id` هرگز عوض نمی‌شود، حتی با تغییر `type`                           | FR-020، FR-021 |
| ۴   | هیچ `Request` بدون `Response` تأییدشده بسته نمی‌شود                          | اصل IV         |
| ۵   | هر `Response` با `kind = reject` هر سه بخش را دارد                           | FR-031         |
| ۶   | هر `Decision` با `outcome = execute` دقیقاً یک متریک و یک تاریخ بازبینی دارد | اصل V          |
| ۷   | حداکثر یک `QueueItem` هم‌زمان `in_progress`                                  | FR-036         |
| ۸   | هیچ `CouncilSession` با کمتر از سه کارت                                      | FR-039         |
| ۹   | هیچ رکورد حذف‌شده‌ای وجود ندارد                                              | FR-027         |
| ۱۰  | زمان‌ها UTC ذخیره و جلالی نمایش داده می‌شوند                                 | R-07           |

# Contract — تریاژ (Triage API)

**Feature**: `001-request-intake-triage` · **Version**: 1.0
**مالک قرارداد**: هسته (Liara). مصرف‌کننده: ابزار تریاژ روی ماشین مدیر محصول.

> **چرا این قرارداد وجود دارد** (R-10، FR-054): تحلیل و پیش‌نویس پاسخ بیرون از سامانه انجام
> می‌شود، چون مخزن دانش آنجاست. این قرارداد عمداً **دربارهٔ اینکه چه کسی تحلیل می‌کند بی‌طرف
> است** — اگر روزی تحلیل به درون سامانه منتقل شود، مصرف‌کننده عوض می‌شود نه قرارداد.

**احراز هویت**: نشست کاربر با نقش `product`. تماس داخل کشور است و پایدار فرض می‌شود.

---

## ۱. `GET /api/triage/batch` — بستهٔ تریاژ

همهٔ درخواست‌های نیازمند تصمیم، با هر چیزی که برای قضاوت لازم است.

**Query**: `?status=new,need_data&limit=50`

**Response `200`**

```json
{
  "generatedAt": "2026-08-25T06:30:00Z",
  "requests": [
    {
      "id": "REQ-149",
      "type": "bug",
      "originalType": "bug",
      "unit": "editorial",
      "submitterName": "…",
      "submittedAt": "2026-08-24T06:44:00Z",
      "responseDueAt": "2026-08-31T06:44:00Z",
      "daysRemaining": 6,
      "atRisk": false,
      "rawAnswers": { "…": "عین متن فارسی، دست‌نخورده" },
      "attachments": [],
      "serviceRef": null,
      "suggestedServiceRef": "S-21",
      "similarRequests": [{ "id": "REQ-118", "title": "…", "similarity": "keyword" }]
    }
  ],
  "queueSnapshot": {
    "items": [
      { "requestId": "REQ-118", "position": 1, "estimateDays": 10, "status": "in_progress" }
    ],
    "freeCapacityDays": 7
  },
  "extractionRules": { "confidence": { "version": 3, "…": {} } }
}
```

**قواعد**

- `rawAnswers` MUST عیناً همان چیزی باشد که کاربر نوشت — بدون خلاصه‌سازی یا نرمال‌سازی (اصل II).
- `suggestedServiceRef` صرفاً **پیشنهاد** است؛ تصمیم با تریاژ است (FR-022).
- `similarRequests` صرفاً کمکی است و MUST NOT ادغام خودکار انجام دهد.
- `atRisk` MUST از `responseDueAt` مشتق شود و **پیش از** نقض `true` شود (FR-030، اصل IV).

---

## ۲. `POST /api/triage/{requestId}/decide` — ثبت نتیجهٔ تریاژ

```json
{
  "type": "bug",
  "serviceRef": "S-21",
  "isCritical": true,
  "outcome": "convert",
  "derived": [
    { "dimension": "severity", "value": "critical", "ruleVersion": 3, "overridden": true }
  ],
  "response": {
    "kind": "convert",
    "body": "REQ-149 — بررسی شد ✅ …",
    "approvedBy": "product"
  },
  "queue": { "insertAtPosition": 1, "estimateDays": 8 }
}
```

**Response `200`**

```json
{
  "requestId": "REQ-149",
  "status": "answered",
  "responseId": "RSP-0312",
  "displaced": [{ "requestId": "REQ-131", "delayDays": 8 }]
}
```

**قواعد اعتبارسنجی — سامانه MUST رد کند اگر:**

| شرط                                                        | خطا                                 |
| ---------------------------------------------------------- | ----------------------------------- |
| `outcome = reject` و هر یک از سه بخش خالی باشد             | `422 REJECT_INCOMPLETE` (FR-031)    |
| `response.approvedBy` خالی باشد                            | `422 APPROVAL_REQUIRED` (FR-033)    |
| `serviceRef` خالی باشد و `"unknown"` هم صریحاً نیامده باشد | `422 SERVICE_REF_REQUIRED` (SC-009) |
| `outcome = merge` بدون `mergedInto`                        | `422 MERGE_TARGET_REQUIRED`         |
| تلاش برای تغییر `rawAnswers`                               | `403 IMMUTABLE` (اصل II)            |

- تغییر `type` MUST مجاز باشد و `id` را عوض نکند (FR-021)؛ در `AuditEntry` ثبت شود.
- `displaced` MUST همیشه در پاسخ برگردد، حتی اگر خالی باشد — تا هزینهٔ فرصت هرگز نامرئی نماند (FR-037).

---

## ۳. `POST /api/decisions` — ثبت تصمیم جلسه یا مسیر سریع

```json
{
  "requestId": "REQ-153",
  "forum": "council",
  "outcome": "execute",
  "successMetric": "نرخ گوش‌دادن خلاصهٔ صوتی در دو هفته از ۵٪ بازدیدکنندگان بگذرد",
  "reviewDate": "2026-09-24",
  "displaced": ["REQ-131"],
  "sessionId": "CS-004"
}
```

**قواعد**

| شرط                                                      | خطا                                      |
| -------------------------------------------------------- | ---------------------------------------- |
| `outcome = execute` بدون `successMetric` یا `reviewDate` | `422 METRIC_AND_REVIEW_REQUIRED` (اصل V) |
| بیش از یک متریک                                          | `422 EXACTLY_ONE_METRIC`                 |
| `forum = council` و جلسه کمتر از سه کارت داشته باشد      | `422 MIN_THREE_CARDS` (FR-039)           |

**استثنای مسیر سریع**: `forum = fast_track` MUST بدون این سه فیلد هم **پذیرفته شود** و آیتم
بلافاصله وارد اجرا گردد — ولی رکورد `incomplete` علامت می‌خورد و پس از ۴۸ ساعت در فهرست هشدار
ظاهر می‌شود. اجرا هرگز مسدود نمی‌شود (اصل V، FR-042، FR-043).

---

## ۴. `POST /api/decisions/{id}/review` — ثبت نتیجهٔ بازبینی

```json
{ "reviewOutcome": "worked", "note": "…" }
```

نتیجه به تفکیک `forum` در گزارش دوره جمع می‌شود (FR-044).

---

## ۵. `GET /api/reports/period` — قیف و متریک‌های فرآیند

```json
{
  "from": "2026-06-22",
  "to": "2026-09-22",
  "funnel": { "submitted": 34, "evaluated": 9, "executed": 3 },
  "avgResponseDays": 5.2,
  "slaBreaches": 0,
  "unitDiversity": 4,
  "fastTrackShare": 0.33,
  "successRateByForum": { "council": 0.75, "fast_track": 0.4 }
}
```

مستقیماً SC-001، SC-006، SC-007، SC-008 و SC-010 را تغذیه می‌کند.

---

## ۶. `POST /api/dashboard/snapshot` — خروجی آفلاین

خروجی: یک فایل HTML خودبسنده با داده و استایل درون‌خطی، به‌عنوان سند رسمی همان جلسه (FR-050، R-09).

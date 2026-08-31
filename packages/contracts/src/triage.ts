/**
 * قرارداد تریاژ، تصمیم و گزارش.
 *
 * منبع: [contracts/triage-api.md](../../../specs/001-request-intake-triage/contracts/triage-api.md)
 *
 * این قرارداد عمداً **دربارهٔ اینکه چه کسی تحلیل می‌کند بی‌طرف است** (R-10،
 * FR-054). امروز تحلیل بیرون از سامانه و روی ماشین مدیر محصول انجام می‌شود،
 * چون مخزن دانش آنجاست. اگر روزی به درون سامانه منتقل شد، **مصرف‌کننده عوض
 * می‌شود نه قرارداد**.
 *
 * احراز هویت: نشست کاربر با نقش `product`.
 */

import type {
  Attachment,
  DecisionForum,
  DecisionOutcome,
  DerivedDimension,
  IsoDate,
  IsoUtcTimestamp,
  RawAnswers,
  RequestStatus,
  RequestType,
  ResponseKind,
  ReviewOutcome,
  Unit,
} from './common';

// ── ۱. GET /api/triage/batch ────────────────────────────────────────────────

export interface TriageBatchQuery {
  /** پیش‌فرض: `new,need_data`. */
  status?: RequestStatus[];
  limit?: number;
}

export interface SimilarRequest {
  id: string;
  title: string;
  /** امروز فقط `keyword` — اصل VII، بدون جست‌وجوی برداری. */
  similarity: 'keyword';
}

/** یک درخواست در بستهٔ تریاژ، با هرچه برای قضاوت لازم است. */
export interface TriageBatchItem {
  id: string;
  type: RequestType;
  /** حدس اولیهٔ ثبت‌کننده — برای سنجش نرخ دسته‌بندی اشتباه. */
  originalType: RequestType;
  unit: Unit;
  submitterName: string;
  submittedAt: IsoUtcTimestamp;
  responseDueAt: IsoUtcTimestamp;
  daysRemaining: number;
  /** MUST از `responseDueAt` مشتق شود و **پیش از** نقض `true` شود (FR-030). */
  atRisk: boolean;
  /** عیناً همان چیزی که کاربر نوشت — بدون خلاصه‌سازی یا نرمال‌سازی (اصل II). */
  rawAnswers: RawAnswers;
  attachments: Attachment[];
  serviceRef: string | null;
  /** صرفاً **پیشنهاد**. تصمیم با تریاژ است (FR-022). */
  suggestedServiceRef: string | null;
  /** صرفاً کمکی. MUST NOT ادغام خودکار انجام دهد. */
  similarRequests: SimilarRequest[];
}

export interface QueueSnapshotItem {
  requestId: string;
  position: number;
  estimateDays: number | null;
  status: RequestStatus;
}

/**
 * تصویر صف ظرفیت.
 *
 * تا ساخته شدن صف (فاز ۶ / US4) این کلید با `items: []` و
 * `freeCapacityDays: null` برمی‌گردد — قرارداد رعایت می‌شود، مقدار تهی است.
 */
export interface QueueSnapshot {
  items: QueueSnapshotItem[];
  /** آیتم بدون `estimateDays` در این محاسبه وارد نمی‌شود. */
  freeCapacityDays: number | null;
}

export interface TriageBatchResponse {
  generatedAt: IsoUtcTimestamp;
  requests: TriageBatchItem[];
  queueSnapshot: QueueSnapshot;
  /** نسخهٔ جاری هر بُعد، تا مصرف‌کننده بداند با کدام قاعده قضاوت می‌کند. */
  extractionRules: Partial<Record<DerivedDimension, { version: number }>>;
}

// ── ۲. POST /api/triage/{requestId}/decide ──────────────────────────────────

export interface DerivedValueInput {
  dimension: DerivedDimension;
  value: string;
  ruleVersion: number;
  /** اگر انسان مقدار قاعده را دستی عوض کرده باشد. */
  overridden?: boolean;
}

export interface TriageResponseInput {
  kind: ResponseKind;
  body: string;
  /** **الزامی.** خالی بودنش `422 APPROVAL_REQUIRED` می‌دهد (FR-033). */
  approvedBy: string;
  /** هر سه وقتی `kind = reject` الزامی‌اند (FR-031). */
  rejectUnderstood?: string;
  rejectWhyNot?: string;
  rejectWhenYes?: string;
}

export interface TriageQueueInput {
  insertAtPosition: number;
  estimateDays?: number;
}

export interface TriageDecideRequest {
  /** تغییرش مجاز است و `id` را عوض نمی‌کند (FR-021). */
  type: RequestType;
  /** الزامی — یا ارجاع واقعی، یا صریحاً `"unknown"` (SC-009). */
  serviceRef: string;
  /** **فقط در تریاژ تعیین می‌شود، نه توسط ثبت‌کننده.** */
  isCritical: boolean;
  outcome: ResponseKind;
  /** الزامی وقتی `outcome = merge`. */
  mergedInto?: string;
  derived?: DerivedValueInput[];
  response: TriageResponseInput;
  queue?: TriageQueueInput;
}

export interface DisplacedItem {
  requestId: string;
  delayDays: number;
}

export interface TriageDecideResponse {
  requestId: string;
  status: RequestStatus;
  responseId: string;
  /**
   * **همیشه برمی‌گردد، حتی خالی** — تا هزینهٔ فرصت هرگز نامرئی نماند (FR-037).
   * تا ساخته شدن صف (فاز ۶) همیشه `[]` است.
   */
  displaced: DisplacedItem[];
}

// ── ۳. POST /api/decisions ──────────────────────────────────────────────────

export interface CreateDecisionRequest {
  requestId: string;
  forum: DecisionForum;
  outcome: DecisionOutcome;
  /**
   * الزامی وقتی `outcome = execute` — **مگر** `forum = fast_track`، که بدون آن
   * هم پذیرفته می‌شود ولی `incomplete` علامت می‌خورد (اصل V، FR-042، FR-043).
   */
  successMetric?: string;
  reviewDate?: IsoDate;
  displaced?: string[];
  /** الزامی وقتی `forum = council` — جلسه MUST دست‌کم سه کارت داشته باشد. */
  sessionId?: string;
}

export interface CreateDecisionResponse {
  id: string;
  requestId: string;
  forum: DecisionForum;
  /** `true` یعنی مسیر سریعی که هنوز سه فیلدش کامل نشده. */
  incomplete: boolean;
  /** وقتی `incomplete`، از این لحظه به بعد در فهرست هشدار ظاهر می‌شود. */
  alertsAfter: IsoUtcTimestamp | null;
  displaced: DisplacedItem[];
}

// ── ۴. POST /api/decisions/{id}/review ──────────────────────────────────────

export interface ReviewDecisionRequest {
  reviewOutcome: ReviewOutcome;
  note?: string;
}

export interface ReviewDecisionResponse {
  id: string;
  reviewOutcome: ReviewOutcome;
  reviewedAt: IsoUtcTimestamp;
}

// ── ۵. GET /api/reports/period ──────────────────────────────────────────────

/** مستقیماً SC-001، SC-006، SC-007، SC-008 و SC-010 را تغذیه می‌کند. */
export interface ReportPeriodResponse {
  from: IsoDate;
  to: IsoDate;
  funnel: {
    submitted: number;
    evaluated: number;
    executed: number;
  };
  avgResponseDays: number;
  slaBreaches: number;
  /** چند واحد سازمانی مختلف در این دوره ثبت کرده‌اند (SC-008). */
  unitDiversity: number;
  fastTrackShare: number;
  /** نرخ موفقیت MUST به تفکیک مرجع قابل محاسبه باشد (FR-044). */
  successRateByForum: Partial<Record<DecisionForum, number>>;
}

// ── ۶. POST /api/dashboard/snapshot ─────────────────────────────────────────

export interface DashboardSnapshotResponse {
  /** فایل HTML خودبسنده با داده و استایل درون‌خطی و صفر درخواست بیرونی (R-09). */
  path: string;
  generatedAt: IsoUtcTimestamp;
  sizeBytes: number;
}

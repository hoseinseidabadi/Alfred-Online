/**
 * قرارداد پل لبه ⇄ هسته.
 *
 * منبع: [contracts/bridge-api.md](../../../specs/001-request-intake-triage/contracts/bridge-api.md)
 *
 * قاعدهٔ حاکم (اصل III): **تمام تماس‌ها از سمت لبه آغاز می‌شوند.** هسته هرگز
 * تماس خروجی به خارج نمی‌گیرد — ضعیف‌ترین مسیر اصلاً استفاده نمی‌شود.
 *
 * احراز هویت: هدر `X-Bridge-Key`. هر تماس بدون آن `401`.
 */

import type {
  AccessStatus,
  Attachment,
  IsoUtcTimestamp,
  RawAnswers,
  RequestType,
  Unit,
} from './common';

/** نام هدر راز مشترک پل. */
export const BRIDGE_KEY_HEADER = 'x-bridge-key';

// ── ۱. POST /bridge/submissions ─────────────────────────────────────────────

/** یک ثبت که لبه تحویل می‌دهد. */
export interface BridgeSubmission {
  /** `REQ-NNN` — در لبه صادر شده و کلید idempotency است. */
  requestId: string;
  chatId: string;
  submitterName: string;
  unit: Unit;
  /** حدس ثبت‌کننده. هسته آن را در `originalType` هم نگه می‌دارد. */
  requestType: RequestType;
  rawAnswers: RawAnswers;
  attachments: Attachment[];
  /** مبدأ محاسبهٔ مهلت هفت‌روزه. هسته خودش `+7d` را حساب می‌کند. */
  submittedAt: IsoUtcTimestamp;
}

export interface BridgeSubmissionsRequest {
  /** MUST به‌ترتیب `submittedAt` مرتب باشد. */
  submissions: BridgeSubmission[];
}

export interface BridgeRejectedSubmission {
  requestId: string;
  reason: string;
}

/**
 * پاسخ تحویل.
 *
 * ارسال دوبارهٔ همان `requestId` MUST رکورد تکراری نسازد و MUST همان
 * `accepted` را برگرداند. اگر یک قلم رد شد، بقیه همچنان پردازش می‌شوند.
 */
export interface BridgeSubmissionsResponse {
  accepted: string[];
  rejected: BridgeRejectedSubmission[];
}

// ── ۲. GET /bridge/outbound ─────────────────────────────────────────────────

/** پاسخ تأییدشده‌ای که هنوز به کاربر نرسیده است. */
export interface BridgeOutboundResponse {
  /** `RSP-NNNN` — کلید idempotency سمت لبه. */
  responseId: string;
  requestId: string;
  chatId: string;
  /** متن **آماده و نهایی**. لبه MUST NOT بازنویسی یا خلاصه‌اش کند. */
  body: string;
  approvedAt: IsoUtcTimestamp;
}

/**
 * هسته MUST NOT پاسخی را که `approvedBy` ندارد اینجا بگذارد (FR-033).
 * تا نرسیدن ack، همان پاسخ دوباره برگردانده می‌شود.
 */
export interface BridgeOutboundListResponse {
  responses: BridgeOutboundResponse[];
}

// ── ۳. POST /bridge/outbound/ack ────────────────────────────────────────────

export interface BridgeDeliveryAck {
  responseId: string;
  sentAt: IsoUtcTimestamp;
}

export interface BridgeAckRequest {
  delivered: BridgeDeliveryAck[];
}

/** تنها پس از ack، `Response.deliveredAt` پر می‌شود و درخواست قابل بستن است. */
export interface BridgeAckResponse {
  acknowledged: string[];
}

// ── ۴. GET /bridge/access/{chatId} ──────────────────────────────────────────

/**
 * فقط **استثناهای دستی** (FR-002).
 *
 * منبع اصلی دسترسی، عضویت کانال است که در لبه بررسی می‌شود (R-05). اگر این
 * نقطهٔ تماس در دسترس نبود، لبه MUST به بررسی عضویت اکتفا کند و ثبت را متوقف نکند.
 */
export interface BridgeAccessResponse {
  chatId: string;
  accessStatus: AccessStatus;
}

// ── ۵. GET /bridge/health ───────────────────────────────────────────────────

export interface BridgeHealthResponse {
  ok: boolean;
  coreTime: IsoUtcTimestamp;
}

/**
 * آمار معطل‌ها که لبه با هر چرخهٔ Cron می‌فرستد.
 *
 * هسته نمی‌تواند خودش از لبه بپرسد (اصل III)، پس تنها راهِ دیدنِ «چند قلم در
 * هر جهت معطل مانده» همین است — و FR-019 نمایشش را الزام کرده.
 */
export interface BridgePendingStats {
  /** ثبت‌هایی که هنوز به هسته تحویل نشده‌اند. */
  pendingSubmissions: number;
  /** پاسخ‌هایی که گرفته شده ولی هنوز به کاربر نرسیده. */
  pendingDeliveries: number;
  /** آخرین تماس موفق لبه با هسته. */
  lastSuccessfulContactAt: IsoUtcTimestamp | null;
  /** خطای آخرین تلاش ناموفق، اگر بوده. */
  lastError: string | null;
}

import type { BridgeSubmission, RequestType, Unit } from '@alfred-online/contracts';
import type { Attachment } from '../conversation/state-machine';

/**
 * صف بادوام ثبت‌ها در D1 — اصل III، FR-015، FR-017.
 *
 * **این جدول تنها چیزی است که میان «ثبت کامل شد» و «هسته خبردار شد»
 * می‌ایستد.** در قطعی چند روزه، همه‌چیز اینجا انباشته می‌شود و کاربر هیچ
 * تفاوتی حس نمی‌کند.
 *
 * دو قاعده که کل این ماژول رویشان بنا شده:
 *
 *   ۱. **نوشتن پیش از هر تماس با هسته.** شماره تا وقتی در D1 ننشسته، به
 *      کاربر گفته نمی‌شود. اگر برعکس بود، یک قطعی در همان لحظه یعنی کاربر
 *      شماره‌ای دارد که هیچ‌جا وجود ندارد.
 *
 *   ۲. **هیچ حذفی.** رکورد تحویل‌شده فقط `delivered_to_core_at` می‌گیرد
 *      (ناوردای ۹).
 */

export interface StoredSubmission {
  requestId: string;
  chatId: string;
  submitterName: string;
  unit: Unit;
  requestType: RequestType;
  rawAnswers: Record<string, string>;
  attachments: Attachment[];
  submittedAt: number;
  deliveredToCoreAt: number | null;
  deliveryAttempts: number;
  lastError: string | null;
}

interface Row {
  request_id: string;
  chat_id: string;
  submitter_name: string;
  unit: string;
  request_type: string;
  raw_answers: string;
  attachments: string;
  submitted_at: number;
  delivered_to_core_at: number | null;
  delivery_attempts: number;
  last_error: string | null;
}

export interface NewSubmission {
  requestId: string;
  chatId: string;
  submitterName: string;
  unit: Unit;
  requestType: RequestType;
  rawAnswers: Record<string, string>;
  attachments: Attachment[];
  submittedAt: number;
}

/**
 * ثبت را بادوام می‌کند.
 *
 * `INSERT OR IGNORE` عمدی است: کلید اصلی همان شمارهٔ پیگیری است، پس تلاش
 * دوباره با همان شماره **رکورد تکراری نمی‌سازد و خطا هم نمی‌دهد** — همان
 * idempotency ای که FR-017 می‌خواهد.
 */
export async function persistSubmission(db: D1Database, input: NewSubmission): Promise<void> {
  await db
    .prepare(
      `INSERT OR IGNORE INTO edge_submission
         (request_id, chat_id, submitter_name, unit, request_type,
          raw_answers, attachments, submitted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      input.requestId,
      input.chatId,
      input.submitterName,
      input.unit,
      input.requestType,
      JSON.stringify(input.rawAnswers),
      JSON.stringify(input.attachments),
      input.submittedAt,
    )
    .run();
}

/**
 * ثبت‌های تحویل‌نشده، **قدیمی‌ترین اول**.
 *
 * ترتیب `submitted_at` قید قرارداد است نه سلیقه: پس از بازگشت ارتباط، ثبت‌ها
 * MUST به‌ترتیب زمانی وارد هسته شوند (FR-017، آزمون الزامی ۳).
 */
export async function pendingSubmissions(db: D1Database, limit = 50): Promise<StoredSubmission[]> {
  const { results } = await db
    .prepare(
      `SELECT * FROM edge_submission
       WHERE delivered_to_core_at IS NULL
       ORDER BY submitted_at ASC, request_id ASC
       LIMIT ?`,
    )
    .bind(limit)
    .all<Row>();
  return results.map(toStored);
}

/** رکورد را تحویل‌شده علامت می‌زند. هرگز حذف نمی‌شود. */
export async function markDelivered(
  db: D1Database,
  requestIds: string[],
  deliveredAt: number,
): Promise<void> {
  if (requestIds.length === 0) return;
  const placeholders = requestIds.map(() => '?').join(', ');
  await db
    .prepare(
      `UPDATE edge_submission
       SET delivered_to_core_at = ?, last_error = NULL
       WHERE request_id IN (${placeholders}) AND delivered_to_core_at IS NULL`,
    )
    .bind(deliveredAt, ...requestIds)
    .run();
}

/** تلاش ناموفق را ثبت می‌کند — برای FR-019. */
export async function recordFailure(
  db: D1Database,
  requestIds: string[],
  error: string,
): Promise<void> {
  if (requestIds.length === 0) return;
  const placeholders = requestIds.map(() => '?').join(', ');
  await db
    .prepare(
      `UPDATE edge_submission
       SET delivery_attempts = delivery_attempts + 1, last_error = ?
       WHERE request_id IN (${placeholders}) AND delivered_to_core_at IS NULL`,
    )
    .bind(error.slice(0, 500), ...requestIds)
    .run();
}

/** یک ثبت مشخص. */
export async function findSubmission(
  db: D1Database,
  requestId: string,
): Promise<StoredSubmission | null> {
  const row = await db
    .prepare('SELECT * FROM edge_submission WHERE request_id = ?')
    .bind(requestId)
    .first<Row>();
  return row === null ? null : toStored(row);
}

/** شمار ثبت‌های معطل — بخشی از آمار سلامت پل (FR-019). */
export async function pendingCount(db: D1Database): Promise<number> {
  const row = await db
    .prepare('SELECT COUNT(*) AS n FROM edge_submission WHERE delivered_to_core_at IS NULL')
    .first<{ n: number }>();
  return row?.n ?? 0;
}

/** رکورد ذخیره‌شده را به قالب قرارداد پل تبدیل می‌کند. */
export function toBridgePayload(submission: StoredSubmission): BridgeSubmission {
  return {
    requestId: submission.requestId,
    chatId: submission.chatId,
    submitterName: submission.submitterName,
    unit: submission.unit,
    requestType: submission.requestType,
    rawAnswers: submission.rawAnswers,
    attachments: submission.attachments,
    submittedAt: new Date(submission.submittedAt).toISOString(),
  };
}

function toStored(row: Row): StoredSubmission {
  return {
    requestId: row.request_id,
    chatId: row.chat_id,
    submitterName: row.submitter_name,
    unit: row.unit as Unit,
    requestType: row.request_type as RequestType,
    rawAnswers: JSON.parse(row.raw_answers) as Record<string, string>,
    attachments: JSON.parse(row.attachments) as Attachment[],
    submittedAt: row.submitted_at,
    deliveredToCoreAt: row.delivered_to_core_at,
    deliveryAttempts: row.delivery_attempts,
    lastError: row.last_error,
  };
}

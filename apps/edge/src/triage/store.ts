import type { TriageOutcome } from '@alfred-online/contracts';
import type { StoredSubmission } from '../submission/store';
import type { QuickDecisionInput } from './decision';

/**
 * صف تصمیم‌های تریاژ در D1 — جهت سوم پل.
 *
 * مثل صف ثبت‌ها: کلید اصلی همان شناسهٔ idempotency است و هیچ رکوردی حذف
 * نمی‌شود (ناوردای ۹).
 */

export interface StoredDecision {
  responseId: string;
  requestId: string;
  chatId: string;
  outcome: TriageOutcome;
  body: string;
  rejectUnderstood: string | null;
  rejectWhyNot: string | null;
  rejectWhenYes: string | null;
  approvedBy: string;
  decidedAt: number;
  deliveredToUserAt: number | null;
  deliveredToCoreAt: number | null;
}

interface Row {
  response_id: string;
  request_id: string;
  chat_id: string;
  outcome: string;
  body: string;
  reject_understood: string | null;
  reject_why_not: string | null;
  reject_when_yes: string | null;
  approved_by: string;
  decided_at: number;
  delivered_to_user_at: number | null;
  delivered_to_core_at: number | null;
}

/**
 * شمارهٔ پاسخ بعدی — `RSP-NNNN`.
 *
 * در **لبه** صادر می‌شود، به همان دلیلی که شمارهٔ پیگیری در لبه صادر می‌شود
 * (R-03): میز تریاژ باید با هستهٔ خاموش هم کار کند.
 *
 * برخلاف شمارندهٔ ثبت که Durable Object است، اینجا یک ردیف D1 کافی است:
 * تصمیم‌ها را فقط **یک نفر** می‌گیرد، پس رقابتی وجود ندارد.
 */
export async function issueResponseId(db: D1Database): Promise<string> {
  const row = await db
    .prepare(
      'UPDATE response_counter SET last_number = last_number + 1 WHERE id = 1 RETURNING last_number',
    )
    .first<{ last_number: number }>();
  const n = row?.last_number ?? 1;
  return `RSP-${String(n).padStart(4, '0')}`;
}

/** تصمیم را بادوام می‌کند — **پیش از** تحویل به ثبت‌کننده. */
export async function persistDecision(
  db: D1Database,
  responseId: string,
  input: QuickDecisionInput,
  body: string,
  decidedAt: number,
): Promise<void> {
  await db
    .prepare(
      `INSERT OR IGNORE INTO triage_decision
         (response_id, request_id, chat_id, outcome, body,
          reject_understood, reject_why_not, reject_when_yes,
          approved_by, decided_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      responseId,
      input.requestId,
      input.chatId,
      input.outcome,
      body,
      input.rejectUnderstood ?? null,
      input.rejectWhyNot ?? null,
      input.rejectWhenYes ?? null,
      input.approvedBy,
      decidedAt,
    )
    .run();
}

export async function markDeliveredToUser(
  db: D1Database,
  responseId: string,
  at: number,
): Promise<void> {
  await db
    .prepare('UPDATE triage_decision SET delivered_to_user_at = ? WHERE response_id = ?')
    .bind(at, responseId)
    .run();
}

/** تصمیم‌هایی که هنوز به هسته نرسیده‌اند، قدیمی‌ترین اول. */
export async function pendingDecisions(db: D1Database, limit = 50): Promise<StoredDecision[]> {
  const { results } = await db
    .prepare(
      `SELECT * FROM triage_decision
       WHERE delivered_to_core_at IS NULL
       ORDER BY decided_at ASC, response_id ASC
       LIMIT ?`,
    )
    .bind(limit)
    .all<Row>();
  return results.map(toStored);
}

export async function markDecisionsDelivered(
  db: D1Database,
  responseIds: string[],
  at: number,
): Promise<void> {
  if (responseIds.length === 0) return;
  const placeholders = responseIds.map(() => '?').join(', ');
  await db
    .prepare(
      `UPDATE triage_decision SET delivered_to_core_at = ?, last_error = NULL
       WHERE response_id IN (${placeholders}) AND delivered_to_core_at IS NULL`,
    )
    .bind(at, ...responseIds)
    .run();
}

export async function recordDecisionFailure(
  db: D1Database,
  responseIds: string[],
  error: string,
): Promise<void> {
  if (responseIds.length === 0) return;
  const placeholders = responseIds.map(() => '?').join(', ');
  await db
    .prepare(
      `UPDATE triage_decision
       SET delivery_attempts = delivery_attempts + 1, last_error = ?
       WHERE response_id IN (${placeholders}) AND delivered_to_core_at IS NULL`,
    )
    .bind(error.slice(0, 500), ...responseIds)
    .run();
}

/** آیا این درخواست قبلاً پاسخ گرفته — جلوی پاسخ دوباره را می‌گیرد. */
export async function alreadyAnswered(db: D1Database, requestId: string): Promise<boolean> {
  const row = await db
    .prepare('SELECT 1 AS hit FROM triage_decision WHERE request_id = ? LIMIT 1')
    .bind(requestId)
    .first<{ hit: number }>();
  return row !== null;
}

/**
 * ثبت‌های بدون پاسخ — صندوق ورودی میز تریاژ.
 *
 * فیلتر نوع اختیاری است چون خرابی و بقیه تعهد متفاوتی دارند و مدیر محصول
 * معمولاً یکی را جدا می‌خواهد.
 */
export async function untriaged(
  db: D1Database,
  type: 'bug' | 'improvement' | 'idea' | null,
  limit = 10,
): Promise<StoredSubmission[]> {
  const typeClause = type === null ? '' : 'AND s.request_type = ?';
  const binds: (string | number)[] = type === null ? [limit] : [type, limit];

  const { results } = await db
    .prepare(
      `SELECT s.* FROM edge_submission s
       WHERE NOT EXISTS (
         SELECT 1 FROM triage_decision d WHERE d.request_id = s.request_id
       ) ${typeClause}
       ORDER BY s.submitted_at ASC
       LIMIT ?`,
    )
    .bind(...binds)
    .all<Record<string, unknown>>();

  return results.map((row) => ({
    requestId: row.request_id as string,
    chatId: row.chat_id as string,
    submitterName: row.submitter_name as string,
    unit: row.unit as StoredSubmission['unit'],
    requestType: row.request_type as StoredSubmission['requestType'],
    rawAnswers: JSON.parse(row.raw_answers as string) as Record<string, string>,
    attachments: JSON.parse(row.attachments as string) as StoredSubmission['attachments'],
    submittedAt: row.submitted_at as number,
    deliveredToCoreAt: (row.delivered_to_core_at as number | null) ?? null,
    deliveryAttempts: row.delivery_attempts as number,
    lastError: (row.last_error as string | null) ?? null,
  }));
}

/** شمار پاسخ‌های معطلِ رسیدن به هسته — بخشی از آمار سلامت پل (FR-019). */
export async function pendingDecisionCount(db: D1Database): Promise<number> {
  const row = await db
    .prepare('SELECT COUNT(*) AS n FROM triage_decision WHERE delivered_to_core_at IS NULL')
    .first<{ n: number }>();
  return row?.n ?? 0;
}

function toStored(row: Row): StoredDecision {
  return {
    responseId: row.response_id,
    requestId: row.request_id,
    chatId: row.chat_id,
    outcome: row.outcome as TriageOutcome,
    body: row.body,
    rejectUnderstood: row.reject_understood,
    rejectWhyNot: row.reject_why_not,
    rejectWhenYes: row.reject_when_yes,
    approvedBy: row.approved_by,
    decidedAt: row.decided_at,
    deliveredToUserAt: row.delivered_to_user_at,
    deliveredToCoreAt: row.delivered_to_core_at,
  };
}

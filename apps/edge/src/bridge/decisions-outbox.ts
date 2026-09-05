import {
  BRIDGE_KEY_HEADER,
  type BridgeDecision,
  type BridgeDecisionsResponse,
} from '@alfred-online/contracts';
import type { Env } from '../env';
import {
  markDecisionsDelivered,
  pendingDecisions,
  recordDecisionFailure,
  type StoredDecision,
} from '../triage/store';

/**
 * صف تصمیم‌های تریاژ: از لبه به هسته — جهت سوم پل.
 *
 * دقیقاً همان الگوی `outbox.ts` است و عمداً هم همان: ترتیب زمانی، idempotency
 * روی شناسه، بدون حذف، و **هرگز پرتاب نمی‌کند**.
 *
 * تفاوت معنایی‌اش مهم است: در صف ثبت‌ها، تا نرسیدن به هسته «هیچ‌کس خبر ندارد».
 * اینجا برعکس — **ثبت‌کننده قبلاً جوابش را گرفته**. این صف فقط منبع حقیقت را
 * به‌روز می‌کند. پس تأخیرش کم‌خطرتر است، ولی گم شدنش یعنی تاریخچه ناقص می‌ماند.
 */

export const DECISION_BATCH_SIZE = 50;

export interface DecisionDrainResult {
  attempted: number;
  delivered: string[];
  rejected: string[];
  error: string | null;
}

export async function drainDecisions(
  env: Env,
  now: number = Date.now(),
): Promise<DecisionDrainResult> {
  const pending = await pendingDecisions(env.DB, DECISION_BATCH_SIZE);
  if (pending.length === 0) {
    return { attempted: 0, delivered: [], rejected: [], error: null };
  }

  const ids = pending.map((decision) => decision.responseId);

  let response: Response;
  try {
    response = await fetch(`${env.CORE_URL}/bridge/decisions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [BRIDGE_KEY_HEADER]: env.BRIDGE_KEY,
      },
      body: JSON.stringify({ decisions: pending.map(toBridgeDecision) }),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    await recordDecisionFailure(env.DB, ids, reason);
    return { attempted: pending.length, delivered: [], rejected: [], error: reason };
  }

  if (!response.ok) {
    const reason = `HTTP ${response.status}`;
    await recordDecisionFailure(env.DB, ids, reason);
    return { attempted: pending.length, delivered: [], rejected: [], error: reason };
  }

  let body: BridgeDecisionsResponse;
  try {
    body = (await response.json()) as BridgeDecisionsResponse;
  } catch (error) {
    const reason = `پاسخ نامعتبر: ${error instanceof Error ? error.message : String(error)}`;
    await recordDecisionFailure(env.DB, ids, reason);
    return { attempted: pending.length, delivered: [], rejected: [], error: reason };
  }

  const accepted = body.accepted ?? [];
  const rejected = body.rejected ?? [];

  await markDecisionsDelivered(env.DB, accepted, now);
  if (rejected.length > 0) {
    // رد‌شده‌ها در صف می‌مانند. رایج‌ترین علتش این است که ثبتِ متناظر هنوز
    // نرسیده — که دور بعد خودش حل می‌شود.
    await recordDecisionFailure(
      env.DB,
      pending.filter((d) => !accepted.includes(d.responseId)).map((d) => d.responseId),
      rejected.map((item) => `${item.requestId}: ${item.reason}`).join(' · '),
    );
  }

  return {
    attempted: pending.length,
    delivered: accepted,
    rejected: rejected.map((item) => item.requestId),
    error: null,
  };
}

function toBridgeDecision(stored: StoredDecision): BridgeDecision {
  return {
    responseId: stored.responseId,
    requestId: stored.requestId,
    outcome: stored.outcome,
    body: stored.body,
    ...(stored.rejectUnderstood !== null ? { rejectUnderstood: stored.rejectUnderstood } : {}),
    ...(stored.rejectWhyNot !== null ? { rejectWhyNot: stored.rejectWhyNot } : {}),
    ...(stored.rejectWhenYes !== null ? { rejectWhenYes: stored.rejectWhenYes } : {}),
    approvedBy: stored.approvedBy,
    decidedAt: new Date(stored.decidedAt).toISOString(),
    deliveredToUserAt:
      stored.deliveredToUserAt === null ? null : new Date(stored.deliveredToUserAt).toISOString(),
  };
}

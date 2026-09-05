import { Injectable, Logger } from '@nestjs/common';
import type { BridgeDecision } from '@alfred-online/contracts';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../../common/audit.service';

/**
 * ثبت تصمیم تریاژ در منبع حقیقت — پذیرندهٔ `POST /bridge/decisions`.
 *
 * **این جایی است که «قبلاً چه جوابی داده‌ام» زندگی می‌کند.** میز تلگرامی
 * پاسخ را می‌فرستد و در D1 لبه هم نگه می‌دارد، ولی آن حافظهٔ کوتاه‌مدت است؛
 * تاریخچهٔ کامل اینجاست، کنار خود درخواست.
 *
 * سه قید که اینجا اعمال می‌شوند:
 *
 *   ۱. **idempotent روی `responseId`** — Cron ممکن است یک بسته را دو بار
 *      بفرستد و نباید دو `Response` ساخته شود.
 *
 *   ۲. **درخواست به `answered` می‌رود، نه `closed`.** SC-009 می‌گوید هیچ
 *      درخواستی بدون `serviceRef` بسته نمی‌شود — و میز سریع `serviceRef`
 *      نمی‌گیرد. «پاسخ دادن» با «بستن» یکی نیست.
 *
 *   ۳. **`respondedAt` پر می‌شود** — همان چیزی که ناوردای ۴ برای بستنِ بعدی
 *      لازم دارد، و همان چیزی که تعهد پاسخ را «انجام‌شده» می‌کند.
 */

export type DecisionOutcome =
  | { status: 'accepted'; responseId: string }
  | { status: 'duplicate'; responseId: string }
  | { status: 'rejected'; responseId: string; reason: string };

@Injectable()
export class ResponseService {
  private readonly logger = new Logger(ResponseService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async record(decision: BridgeDecision): Promise<DecisionOutcome> {
    const existing = await this.prisma.response.findUnique({
      where: { id: decision.responseId },
      select: { id: true },
    });
    if (existing !== null) {
      return { status: 'duplicate', responseId: decision.responseId };
    }

    const request = await this.prisma.request.findUnique({
      where: { id: decision.requestId },
      select: { id: true, status: true, respondedAt: true },
    });
    if (request === null) {
      // ثبتش هنوز نرسیده. چرخهٔ Cron اول ثبت‌ها را می‌فرستد، پس این نباید رخ
      // دهد — ولی اگر داد، تصمیم در صف لبه می‌ماند تا دور بعد.
      return {
        status: 'rejected',
        responseId: decision.responseId,
        reason: `درخواست ${decision.requestId} هنوز در هسته نیست`,
      };
    }

    const decidedAt = new Date(decision.decidedAt);
    if (Number.isNaN(decidedAt.getTime())) {
      return {
        status: 'rejected',
        responseId: decision.responseId,
        reason: `decidedAt نامعتبر: ${decision.decidedAt}`,
      };
    }

    const deliveredAt =
      decision.deliveredToUserAt === null ? null : new Date(decision.deliveredToUserAt);

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.response.create({
          data: {
            id: decision.responseId,
            requestId: decision.requestId,
            kind: decision.outcome,
            // **عیناً** همان متنی که ثبت‌کننده دید. هسته بازنویسی‌اش نمی‌کند.
            body: decision.body,
            rejectUnderstood: decision.rejectUnderstood ?? null,
            rejectWhyNot: decision.rejectWhyNot ?? null,
            rejectWhenYes: decision.rejectWhenYes ?? null,
            approvedBy: decision.approvedBy,
            approvedAt: decidedAt,
            handedToEdgeAt: decidedAt,
            // برخلاف مسیر عادی، تحویل **پیش از** رسیدن به هسته رخ داده.
            deliveredAt,
          },
        });

        await tx.request.update({
          where: { id: decision.requestId },
          data: {
            triageOutcome: decision.outcome,
            status: 'answered',
            // اولین پاسخ زمان را تثبیت می‌کند؛ پاسخ‌های بعدی عوضش نمی‌کنند.
            respondedAt: request.respondedAt ?? decidedAt,
          },
        });
      });

      // سابقه بیرون از تراکنش: اگر نوشتنش شکست بخورد، نباید تصمیم را برگرداند.
      await this.audit.recordMany([
        {
          entity: 'Request',
          entityId: decision.requestId,
          field: 'status',
          oldValue: request.status,
          newValue: 'answered',
          actor: decision.approvedBy,
        },
        {
          entity: 'Request',
          entityId: decision.requestId,
          field: 'triageOutcome',
          oldValue: null,
          newValue: decision.outcome,
          actor: decision.approvedBy,
        },
      ]);

      return { status: 'accepted', responseId: decision.responseId };
    } catch (error) {
      if (isUniqueViolation(error)) {
        return { status: 'duplicate', responseId: decision.responseId };
      }
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(`ثبت تصمیم ${decision.responseId} شکست خورد: ${reason}`);
      return { status: 'rejected', responseId: decision.responseId, reason };
    }
  }

  /**
   * تاریخچهٔ پاسخ‌های یک درخواست، تازه‌ترین اول.
   *
   * همان چیزی که «قبلاً چه جوابی داده‌ام» را جواب می‌دهد — و بستهٔ تریاژ
   * (T051) از همین می‌خواند تا تریاژگر دو بار به یک چیز جواب ندهد.
   */
  async historyFor(requestId: string) {
    return this.prisma.response.findMany({
      where: { requestId },
      orderBy: { approvedAt: 'desc' },
    });
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 'P2002'
  );
}

import { Injectable, Logger } from '@nestjs/common';
import type { BridgeSubmission } from '@alfred-online/contracts';
import type { Request } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { DeadlineService } from './deadline.service';
import { SubmitterService } from './submitter.service';

/**
 * پذیرش ثبت از پل — T026.
 *
 * سه قید قرارداد که اینجا اجرا می‌شوند:
 *
 *   ۱. **`rawAnswers` دست نمی‌خورد** — نه نرمال‌سازی، نه trim، نه مرتب‌سازی
 *      کلید. عیناً همان چیزی که لبه فرستاد (اصل II، ناوردای ۱).
 *
 *   ۲. **`responseDueAt` را هسته خودش حساب می‌کند**، نه لبه. اگر لبه
 *      می‌فرستادش، دو منبع حقیقت برای یک ناوردا داشتیم.
 *
 *   ۳. **idempotent روی `requestId`** — ارسال دوباره رکورد تکراری نمی‌سازد و
 *      همان `accepted` را برمی‌گرداند (FR-017).
 */

export type AcceptOutcome =
  | { status: 'accepted'; requestId: string }
  | { status: 'duplicate'; requestId: string }
  | { status: 'rejected'; requestId: string; reason: string };

@Injectable()
export class RequestService {
  private readonly logger = new Logger(RequestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly submitters: SubmitterService,
    private readonly deadlines: DeadlineService,
  ) {}

  /**
   * یک ثبت را می‌پذیرد.
   *
   * خطای یک قلم **بقیه را زمین نمی‌زند** — قرارداد صریح است: «اگر یک قلم رد
   * شد، بقیه همچنان پردازش می‌شوند و در `rejected` گزارش می‌گردند.»
   */
  async accept(submission: BridgeSubmission): Promise<AcceptOutcome> {
    const existing = await this.prisma.request.findUnique({
      where: { id: submission.requestId },
      select: { id: true },
    });
    if (existing !== null) {
      return { status: 'duplicate', requestId: submission.requestId };
    }

    const submittedAt = new Date(submission.submittedAt);
    if (Number.isNaN(submittedAt.getTime())) {
      return {
        status: 'rejected',
        requestId: submission.requestId,
        reason: `submittedAt نامعتبر: ${submission.submittedAt}`,
      };
    }

    try {
      const submitter = await this.submitters.upsert({
        chatId: submission.chatId,
        displayName: submission.submitterName,
        unit: submission.unit,
      });

      await this.prisma.request.create({
        data: {
          id: submission.requestId,
          type: submission.requestType,
          // حدس اولیهٔ ثبت‌کننده — برای سنجش نرخ دسته‌بندی اشتباه.
          originalType: submission.requestType,
          submitterId: submitter.id,
          unit: submission.unit,
          // بدون هیچ دست‌کاری. اصل II.
          rawAnswers: submission.rawAnswers as unknown as Prisma.InputJsonValue,
          attachments: submission.attachments as unknown as Prisma.InputJsonValue,
          submittedAt,
          responseDueAt: this.deadlines.dueAt(submittedAt, submission.requestType),
          source: 'bot',
        },
      });

      await this.submitters.countRequest(submitter.id);
      return { status: 'accepted', requestId: submission.requestId };
    } catch (error) {
      // مسابقه روی همان `requestId`: دو چرخهٔ Cron هم‌زمان. نتیجه‌اش همان
      // «تکراری» است، نه شکست — وگرنه لبه بی‌دلیل دوباره تلاش می‌کند.
      if (isUniqueViolation(error)) {
        return { status: 'duplicate', requestId: submission.requestId };
      }
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(`پذیرش ${submission.requestId} شکست خورد: ${reason}`);
      return { status: 'rejected', requestId: submission.requestId, reason };
    }
  }

  async byId(requestId: string): Promise<Request | null> {
    return this.prisma.request.findUnique({ where: { id: requestId } });
  }

  async count(): Promise<number> {
    return this.prisma.request.count();
  }
}

/** نقض قید یکتایی در Prisma. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 'P2002'
  );
}

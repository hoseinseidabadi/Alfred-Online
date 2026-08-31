import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import type {
  BridgeAccessResponse,
  BridgeHealthResponse,
  BridgePendingStats,
  BridgeSubmissionsRequest,
  BridgeSubmissionsResponse,
} from '@alfred-online/contracts';
import { PrismaService } from '../common/prisma.service';
import { RequestService } from '../modules/intake/request.service';
import { BridgeKeyGuard } from './bridge-key.guard';
import { BridgeHealthService } from './bridge-health.service';

/**
 * پل لبه ⇄ هسته — T027، T028، T029.
 *
 * **تمام تماس‌ها از سمت لبه آغاز می‌شوند** (اصل III). هیچ متدی در این کنترلر
 * تماس خروجی نمی‌گیرد؛ همه فقط جواب می‌دهند. ضعیف‌ترین مسیر — تماس از داخل
 * ایران به خارج — اصلاً استفاده نمی‌شود.
 */
@Controller('bridge')
@UseGuards(BridgeKeyGuard)
export class BridgeController {
  constructor(
    private readonly requests: RequestService,
    private readonly health: BridgeHealthService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * تحویل ثبت‌های معطل — T027.
   *
   * ترتیب ورودی **حفظ می‌شود**: اقلام یکی‌یکی و به‌ترتیب پردازش می‌شوند، نه
   * موازی. در مقیاس این سامانه هزینه‌اش ناچیز است و FR-017 صریحاً ترتیب زمانی
   * را الزام کرده.
   *
   * رد شدن یک قلم بقیه را متوقف نمی‌کند.
   */
  @Post('submissions')
  async submissions(@Body() body: BridgeSubmissionsRequest): Promise<BridgeSubmissionsResponse> {
    const accepted: string[] = [];
    const rejected: BridgeSubmissionsResponse['rejected'] = [];

    for (const submission of body.submissions ?? []) {
      const outcome = await this.requests.accept(submission);
      if (outcome.status === 'rejected') {
        rejected.push({ requestId: outcome.requestId, reason: outcome.reason });
      } else {
        // «تکراری» هم `accepted` است — لبه باید بتواند رکورد را از صف بردارد.
        // اگر «رد» گزارش می‌شد، تا ابد دوباره می‌فرستادش.
        accepted.push(outcome.requestId);
      }
    }

    return { accepted, rejected };
  }

  /** سلامت پل — T028. لبه با هر چرخه صدایش می‌زند تا بداند هسته زنده است. */
  @Get('health')
  async healthCheck(): Promise<BridgeHealthResponse> {
    // یک پرس‌وجوی واقعی، نه فقط «سرویس بالاست»: اگر پایگاه داده نباشد، هسته
    // عملاً در دسترس نیست و لبه باید صف را نگه دارد.
    await this.prisma.$queryRaw`SELECT 1`;
    return { ok: true, coreTime: new Date().toISOString() };
  }

  /**
   * آمار معطل‌های لبه — FR-019.
   *
   * **افزودهٔ ما به قرارداد است.** بند ۵ قرارداد می‌گوید «لبه نتیجهٔ آخرین
   * تماس‌ها را نگه می‌دارد تا هسته بتواند وضعیت پل را نمایش دهد» ولی مکانیزمش
   * را نگفته. چون هسته MUST NOT تماس خروجی بگیرد (اصل III)، تنها راه این است
   * که لبه آمار را بفرستد. در `contracts/bridge-api.md` مستند شد.
   */
  @Post('health/stats')
  reportStats(@Body() stats: BridgePendingStats): { received: true } {
    this.health.record(stats);
    return { received: true };
  }

  /**
   * استثناهای دسترسی — T029، FR-002.
   *
   * منبع اصلی دسترسی، عضویت کانال است که در **لبه** بررسی می‌شود (R-05).
   * این فقط استثناهای دستی را می‌دهد؛ در دسترس نبودنش MUST ثبت را متوقف نکند.
   */
  @Get('access/:chatId')
  async access(@Param('chatId') chatId: string): Promise<BridgeAccessResponse> {
    const submitter = await this.prisma.submitter.findUnique({
      where: { chatId },
      select: { accessStatus: true },
    });
    return { chatId, accessStatus: submitter?.accessStatus ?? 'member' };
  }
}

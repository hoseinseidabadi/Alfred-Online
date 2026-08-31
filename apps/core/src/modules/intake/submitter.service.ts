import { Injectable } from '@nestjs/common';
import type { Submitter, Unit } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';

/**
 * ثبت‌کننده — T025.
 *
 * هویت از پیام‌رسان می‌آید و `chatId` یکتاست: یک حساب تلگرام، یک ثبت‌کننده.
 *
 * **واحد سازمانی یک بار پرسیده می‌شود و می‌ماند** (FR-003). لبه هم آن را کش
 * می‌کند، ولی منبع حقیقتش اینجاست — اگر شیء گفت‌وگو پاک شود، واحد از دست
 * نمی‌رود.
 */
@Injectable()
export class SubmitterService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * ثبت‌کننده را می‌سازد یا به‌روز می‌کند.
   *
   * `displayName` هر بار تازه می‌شود چون آدم‌ها نامشان را در تلگرام عوض
   * می‌کنند و نام قدیمی در بستهٔ تریاژ گیج‌کننده است.
   *
   * `unit` هم به‌روز می‌شود چون FR-003 صریحاً «با امکان اصلاح توسط خود کاربر»
   * گفته — ولی این تنها راه عوض شدنش است، نه پرسش دوباره.
   */
  async upsert(input: { chatId: string; displayName: string; unit: Unit }): Promise<Submitter> {
    return this.prisma.submitter.upsert({
      where: { chatId: input.chatId },
      create: {
        chatId: input.chatId,
        displayName: input.displayName,
        unit: input.unit,
      },
      update: {
        displayName: input.displayName,
        unit: input.unit,
      },
    });
  }

  /** پس از ثبت موفق، شمارنده را جلو می‌برد. */
  async countRequest(submitterId: string): Promise<void> {
    await this.prisma.submitter.update({
      where: { id: submitterId },
      data: { requestCount: { increment: 1 } },
    });
  }

  async byChatId(chatId: string): Promise<Submitter | null> {
    return this.prisma.submitter.findUnique({ where: { chatId } });
  }
}

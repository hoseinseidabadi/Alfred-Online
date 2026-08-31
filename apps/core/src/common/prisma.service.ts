import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

/**
 * اتصال به منبع حقیقت عملیاتی.
 *
 * از Prisma 7 به بعد، کلاینت از راه **driver adapter** وصل می‌شود و نشانی
 * اتصال دیگر در `schema.prisma` نمی‌آید.
 *
 * `DATABASE_URL` از `.env` محلی یا Secret Store می‌آید و **هرگز در ریپو نیست**
 * (بند «اسرار و دسترسی»).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (connectionString === undefined || connectionString.length === 0) {
      // بدون این، خطا در اولین پرس‌وجو و با پیامی مبهم بیرون می‌زند.
      throw new Error('DATABASE_URL تنظیم نشده است — `apps/core/.env` را بساز.');
    }
    super({ adapter: new PrismaPg({ connectionString }) });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('اتصال به پایگاه دادهٔ هسته برقرار شد');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

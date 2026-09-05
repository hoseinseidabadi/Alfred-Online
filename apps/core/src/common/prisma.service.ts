import { mkdirSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '@prisma/client';

/**
 * اتصال به منبع حقیقت عملیاتی.
 *
 * از Prisma 7 به بعد، کلاینت از راه **driver adapter** وصل می‌شود و نشانی
 * اتصال دیگر در `schema.prisma` نمی‌آید.
 *
 * پایگاه داده **SQLite روی دیسک اپ** است، نه سرویس جدا — اصل VII. دلیلش در
 * سرآیند `schema.prisma` مستند شده، به‌همراه اینکه کِی باید تجدید نظر کرد.
 *
 * `DATABASE_URL` از `.env` محلی یا Secret Store می‌آید و **هرگز در ریپو نیست**
 * (بند «اسرار و دسترسی»).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const url = process.env.DATABASE_URL;
    if (url === undefined || url.length === 0) {
      // بدون این، خطا در اولین پرس‌وجو و با پیامی مبهم بیرون می‌زند.
      throw new Error('DATABASE_URL تنظیم نشده است — `apps/core/.env` را بساز.');
    }
    super({ adapter: new PrismaBetterSqlite3({ url: ensureSqlitePath(url) }) });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('اتصال به پایگاه دادهٔ هسته برقرار شد');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

/**
 * مسیر فایل SQLite را مطلق می‌کند و پوشه‌اش را می‌سازد.
 *
 * دو دلیل: مسیر نسبی به `process.cwd()` گره می‌خورد که در استقرار لیارا با
 * پوشهٔ اپ یکی نیست، و SQLite پوشهٔ ناموجود را خودش نمی‌سازد — فقط با
 * «directory does not exist» می‌شکند.
 */
function ensureSqlitePath(url: string): string {
  if (!url.startsWith('file:')) return url;
  const path = url.slice('file:'.length);
  const absolute = isAbsolute(path) ? path : resolve(process.cwd(), path);
  mkdirSync(dirname(absolute), { recursive: true });
  return `file:${absolute}`;
}

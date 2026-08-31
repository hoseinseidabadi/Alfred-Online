import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

/**
 * از Prisma 7 به بعد دو چیز عوض شده:
 *
 *   ۱. نشانی اتصال دیگر در `schema.prisma` نمی‌آید — Migrate آن را از اینجا
 *      می‌خواند و کلاینت از راه driver adapter وصل می‌شود.
 *   ۲. Prisma دیگر خودش `.env` را بار نمی‌کند.
 *
 * بارگذاری با `process.loadEnvFile` بومیِ Node انجام می‌شود، نه با dotenv —
 * یک وابستگی کمتر (اصل VII).
 *
 * `DATABASE_URL` از `.env` محلی یا Secret Store می‌آید و **هرگز در ریپو نیست**.
 */
if (existsSync('.env')) process.loadEnvFile('.env');

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env.DATABASE_URL ?? '' },
});

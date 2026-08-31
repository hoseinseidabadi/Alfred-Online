import { defineConfig } from 'prisma/config';

/**
 * از Prisma 7 به بعد، نشانی اتصال دیگر در `schema.prisma` نمی‌آید — Migrate
 * آن را از اینجا می‌خواند و کلاینت از راه driver adapter وصل می‌شود.
 *
 * `DATABASE_URL` از `.env` محلی یا Secret Store می‌آید و **هرگز در ریپو نیست**.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env.DATABASE_URL ?? '' },
});

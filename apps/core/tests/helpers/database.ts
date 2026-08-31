import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

/**
 * کمک‌کنندهٔ آزمون‌های یکپارچهٔ هسته.
 *
 * آزمون‌های یکپارچه روی **PostgreSQL واقعی** اجرا می‌شوند، نه روی جایگزین
 * درون‌حافظه‌ای (Technical Context برنامه). چیزهایی که این آزمون‌ها می‌سنجند —
 * قید کلید خارجی، ایندکس یکتا، رفتار `RESTRICT` — اصلاً در جایگزین وجود
 * ندارند و آزمونشان آنجا فقط توهم پوشش است.
 *
 * `CORE_ROOT` و `TEST_DATABASE_URL` را `vitest.config.mts` تزریق می‌کند، پس
 * اینجا هیچ حدسی دربارهٔ مسیر یا محیط زده نمی‌شود.
 */

const CORE_ROOT = process.env.CORE_ROOT ?? process.cwd();

/** نشانی پایگاه دادهٔ آزمون، یا `null` اگر تنظیم نشده باشد. */
export const testDatabaseUrl =
  process.env.TEST_DATABASE_URL !== undefined && process.env.TEST_DATABASE_URL.length > 0
    ? process.env.TEST_DATABASE_URL
    : null;

export const hasTestDatabase = testDatabaseUrl !== null;

/** پیامی که در صورت نبودِ پایگاه داده به‌جای آزمون چاپ می‌شود. */
export const NO_DATABASE_REASON =
  'TEST_DATABASE_URL تنظیم نشده — `docker compose up -d` را بزن و `apps/core/.env` را از `.env.example` بساز.';

let migrated = false;

/**
 * شمای پایگاه دادهٔ آزمون را با آخرین مهاجرت‌ها هم‌راستا می‌کند.
 *
 * `migrate deploy` استفاده می‌شود نه `db push`: همان مسیری که در استقرار طی
 * می‌شود، تا اگر یک مهاجرت روی پایگاه دادهٔ خالی بشکند، اینجا معلوم شود نه
 * در تولید.
 */
export function applyMigrations(): void {
  if (migrated || testDatabaseUrl === null) return;
  execFileSync(process.execPath, [prismaCliPath(), 'migrate', 'deploy'], {
    cwd: CORE_ROOT,
    env: { ...process.env, DATABASE_URL: testDatabaseUrl },
    stdio: 'pipe',
  });
  migrated = true;
}

/**
 * مسیر CLI پرایزما.
 *
 * npm وابستگی‌ها را به ریشهٔ workspace بالا می‌کشد، ولی همیشه نه — هر دو جا
 * بررسی می‌شود تا نه به `require.resolve` نیاز باشد (که در خروجی ESM نیست) و
 * نه به `npx` با shell (که آرگومان را escape نمی‌کند).
 */
function prismaCliPath(): string {
  const candidates = [
    resolve(CORE_ROOT, '../../node_modules/prisma/build/index.js'),
    resolve(CORE_ROOT, 'node_modules/prisma/build/index.js'),
  ];
  const found = candidates.find((path) => existsSync(path));
  if (found === undefined) {
    throw new Error(`CLI پرایزما پیدا نشد. جست‌وجو شد در:\n  ${candidates.join('\n  ')}`);
  }
  return found;
}

/** کلاینتی که به پایگاه دادهٔ آزمون وصل است. */
export function testClient(): PrismaClient {
  if (testDatabaseUrl === null) throw new Error(NO_DATABASE_REASON);
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: testDatabaseUrl }) });
}

/**
 * همهٔ جدول‌ها را خالی می‌کند.
 *
 * `TRUNCATE ... CASCADE` عمداً اینجا استفاده می‌شود و با ناوردای ۹ تناقضی
 * ندارد: آن ناوردا دربارهٔ **کد سامانه** است که هرگز رکوردی حذف نمی‌کند، نه
 * دربارهٔ پاک کردن یک پایگاه دادهٔ آزمونِ دورریختنی بین دو آزمون.
 */
export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  if (tables.length === 0) return;
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

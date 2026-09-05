import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '@prisma/client';

/**
 * کمک‌کنندهٔ آزمون‌های یکپارچهٔ هسته.
 *
 * آزمون‌های یکپارچه روی **همان موتوری** اجرا می‌شوند که در تولید هست —
 * SQLite با همان مهاجرت‌ها. چیزهایی که می‌سنجند (قید کلید خارجی، ایندکس
 * یکتا، رفتار `RESTRICT`) در جایگزین درون‌حافظه‌ای وجود ندارند و آزمونشان
 * آنجا فقط توهم پوشش است.
 *
 * فایل آزمون از فایل توسعه جداست و بین آزمون‌ها خالی می‌شود.
 *
 * `CORE_ROOT` و `TEST_DATABASE_URL` را `vitest.config.mts` تزریق می‌کند، پس
 * اینجا هیچ حدسی دربارهٔ مسیر یا محیط زده نمی‌شود.
 */

const CORE_ROOT = process.env.CORE_ROOT ?? process.cwd();

/**
 * نشانی پایگاه دادهٔ آزمون، یا `null` اگر تنظیم نشده باشد.
 *
 * مسیر نسبی به **مطلق** تبدیل می‌شود: Vitest از ریشهٔ مخزن اجرا می‌شود، پس
 * `file:./data/…` به جای اشتباهی می‌رسید و SQLite با «پوشه وجود ندارد»
 * می‌شکست. `CORE_ROOT` را `vitest.config.mts` تزریق می‌کند.
 */
export const testDatabaseUrl = resolveSqliteUrl(process.env.TEST_DATABASE_URL);

function resolveSqliteUrl(raw: string | undefined): string | null {
  if (raw === undefined || raw.length === 0) return null;
  if (!raw.startsWith('file:')) return raw;
  const path = raw.slice('file:'.length);
  if (isAbsolute(path)) return raw;
  const absolute = resolve(CORE_ROOT, path);
  mkdirSync(dirname(absolute), { recursive: true });
  return `file:${absolute}`;
}

export const hasTestDatabase = testDatabaseUrl !== null;

/** پیامی که در صورت نبودِ پایگاه داده به‌جای آزمون چاپ می‌شود. */
export const NO_DATABASE_REASON =
  'TEST_DATABASE_URL تنظیم نشده — `apps/core/.env` را از `.env.example` بساز.';

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
  try {
    execFileSync(process.execPath, [prismaCliPath(), 'migrate', 'deploy'], {
      cwd: CORE_ROOT,
      env: { ...process.env, DATABASE_URL: testDatabaseUrl },
      stdio: 'pipe',
    });
  } catch (error) {
    throw new Error(describeMigrationFailure(error), { cause: error });
  }
  migrated = true;
}

/**
 * خطای خام پرایزما را به چیزی تبدیل می‌کند که بشود روی آن عمل کرد.
 *
 * چرا لازم است: Vitest شکستِ `beforeAll` را «skipped» گزارش می‌کند، که با
 * یک خطای خام پرایزما ترکیب شود کاملاً گمراه‌کننده است. این تابع خطا را به
 * چیزی تبدیل می‌کند که بشود رویش عمل کرد.
 */
function describeMigrationFailure(error: unknown): string {
  const raw = error instanceof Error ? `${error.message}` : String(error);
  if (raw.includes('P1001') || raw.includes("Can't reach database server")) {
    return [
      'پایگاه دادهٔ آزمون در دسترس نیست.',
      '',
      'محتمل‌ترین علت: داکر دسکتاپ بسته شده و کانتینر Postgres با آن رفته.',
      '',
      'راه‌حل: داکر دسکتاپ را باز کن، بعد `docker compose up -d` را بزن.',
      '',
      `نشانی: ${testDatabaseUrl}`,
    ].join('\n');
  }
  return `اجرای مهاجرت روی پایگاه دادهٔ آزمون شکست خورد:\n${raw}`;
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
  return new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: testDatabaseUrl }) });
}

/**
 * همهٔ جدول‌ها را خالی می‌کند.
 *
 * جزئیاتش در بدنه توضیح داده شده.
 */
export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  const tables = await prisma.$queryRaw<{ name: string }[]>`
    SELECT name FROM sqlite_master
    WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name <> '_prisma_migrations'
  `;
  if (tables.length === 0) return;
  // SQLite دستور TRUNCATE ندارد. کلیدهای خارجی موقتاً خاموش می‌شوند چون همهٔ
  // رابطه‌ها `RESTRICT` اند (ناوردای ۹) و بدون این، پاک کردن ناممکن است.
  //
  // این با ناوردای ۹ تناقضی ندارد: آن ناوردا دربارهٔ **کد سامانه** است که
  // هرگز رکوردی حذف نمی‌کند، نه دربارهٔ پاک کردن یک پایگاه دادهٔ آزمونِ
  // دورریختنی بین دو آزمون.
  await prisma.$executeRawUnsafe('PRAGMA foreign_keys = OFF');
  for (const { name } of tables) {
    await prisma.$executeRawUnsafe(`DELETE FROM "${name}"`);
  }
  await prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON');
}

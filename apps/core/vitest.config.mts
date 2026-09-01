import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

/**
 * پیکربندی آزمون هسته.
 *
 * دو کار اینجا انجام می‌شود که جای دیگری نمی‌شد:
 *
 * ۱. **بارگذاری `.env`** — Vitest از ریشهٔ مخزن اجرا می‌شود، پس مسیر نسبی از
 *    داخل آزمون‌ها به `apps/core/.env` نمی‌رسید. این فایل خودش کنار `.env`
 *    است، پس مسیر را قطعی می‌داند. مقدارِ آمده از محیط (مثلاً در CI) اولویت
 *    دارد و بازنویسی نمی‌شود.
 *
 * ۲. **تبدیل با SWC** — NestJS به `emitDecoratorMetadata` نیاز دارد و esbuild
 *    آن را تولید نمی‌کند.
 */
const coreRoot = import.meta.dirname;
const envFile = resolve(coreRoot, '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

/**
 * اگر `.env` هست و `TEST_DATABASE_URL` را تعریف کرده ولی بارگذاری نشده، یعنی
 * چیزی در خواندن محیط خراب شده — نه اینکه دولوپر پایگاه داده ندارد.
 *
 * چرا این بررسی وجود دارد: یک بار در دنبالهٔ `verify` ده آزمون یکپارچه بی‌صدا
 * skip شدند و نتوانستم بازتولیدش کنم. تفاوت «دیتابیس ندارم» و «دیتابیس دارم
 * ولی محیط بار نشد» از بیرون دیده نمی‌شد. حالا دومی صریح می‌شکند به‌جای
 * اینکه به‌صورت skip بی‌صدا رد شود.
 */
if (existsSync(envFile)) {
  const declared = readFileSync(envFile, 'utf8').includes('TEST_DATABASE_URL=');
  const loaded = (process.env.TEST_DATABASE_URL ?? '').length > 0;
  if (declared && !loaded) {
    throw new Error(
      `TEST_DATABASE_URL در ${envFile} تعریف شده ولی بار نشد.\n` +
        'آزمون‌های یکپارچه بی‌صدا رد می‌شدند — این خطا عمدی است تا آن سکوت تکرار نشود.',
    );
  }
}

export default defineConfig({
  test: {
    name: 'core',
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    globals: true,
    /**
     * فایل‌ها ترتیبی اجرا می‌شوند، نه موازی.
     *
     * آزمون‌های یکپارچه همه روی **یک** پایگاه دادهٔ آزمون‌اند و هر کدام در
     * `beforeEach` جدول‌ها را خالی می‌کند. موازی که باشند، یکی داده‌های دیگری
     * را پاک می‌کند و شکست‌ها تصادفی و گیج‌کننده می‌شوند.
     *
     * جایگزینش — یک شمای جدا به‌ازای هر فایل — برای این مقیاس ماشین‌آلات
     * بی‌مورد است (اصل VII). کل مجموعه چند ثانیه طول می‌کشد.
     */
    fileParallelism: false,
    env: {
      // آزمون‌ها این دو را می‌خوانند و لازم نیست خودشان دنبال مسیر بگردند.
      CORE_ROOT: coreRoot,
      TEST_DATABASE_URL: process.env.TEST_DATABASE_URL ?? '',
    },
  },
  plugins: [swc.vite({ module: { type: 'es6' } })],
});

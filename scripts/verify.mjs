#!/usr/bin/env node
/**
 * دروازهٔ پیش از کامیت.
 *
 * چرا وجود دارد: یک بار با نگاه کردن به خروجی `npm test` و ندیدنِ یک فایل
 * شکست‌خورده، کامیت زدم. خروجی را آدم می‌خواند و آدم اشتباه می‌کند؛ **کد
 * خروج** را نمی‌شود اشتباه خواند.
 *
 * ترتیب عمدی است: قالب‌بندی **پیش از** آزمون‌ها اجرا می‌شود و کامل تمام
 * می‌شود، تا بازنویسی فایل حین خواندنش توسط vitest ممکن نباشد.
 */
import { spawnSync } from 'node:child_process';
/**
 * پایگاه داده SQLite است — یک فایل روی دیسک، نه سرویسی که بالا یا پایین باشد.
 * بررسی پیش‌پروازِ نسخهٔ Postgres با این معماری بی‌موضوع شد و حذف گردید.
 */
const steps = [
  ['قالب‌بندی', 'npm', ['run', 'format']],
  ['ساخت پکیج‌ها', 'npm', ['run', 'build:packages']],
  ['تایپ‌چک', 'npm', ['run', 'typecheck']],
  ['lint', 'npm', ['run', 'lint']],
  ['آزمون‌ها', 'npm', ['test']],
  /**
   * گیت قانون اساسی.
   *
   * تا ۱۴۰۵/۰۶/۰۹ اطلاع‌رسانی بود، چون شش آزمون الزامی هنوز نوشته نشده بودند
   * و قرمزیِ دائمی جلوی کار را می‌گرفت. حالا که هر شش نوشته شده‌اند،
   * **مسدودکننده** است: هر قرمزی یعنی یک ناوردای قانون اساسی شکسته یا
   * آزمونش حذف شده.
   */
  ['گیت قانون اساسی', 'npm', ['run', 'test:resilience']],
];

let failed = null;

for (const [label, command, args] of steps) {
  process.stdout.write(`\n▶ ${label}\n`);
  const result = spawnSync(command, args, { stdio: 'inherit', shell: true });
  if (result.status !== 0) {
    failed = label;
    break;
  }
}

if (failed !== null) {
  process.stderr.write(`\n❌ «${failed}» شکست خورد — کامیت نکن.\n`);
  process.exit(1);
}

process.stdout.write('\n✅ همهٔ دروازه‌ها باز.\n');

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

const steps = [
  ['قالب‌بندی', 'npm', ['run', 'format']],
  ['ساخت پکیج‌ها', 'npm', ['run', 'build:packages']],
  ['تایپ‌چک', 'npm', ['run', 'typecheck']],
  ['lint', 'npm', ['run', 'lint']],
  ['آزمون‌ها', 'npm', ['test']],
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

// گیت قانون اساسی جدا گزارش می‌شود: تا نوشته شدن هر شش آزمون الزامی **عمداً
// قرمز** است، پس نباید جلوی کامیت را بگیرد — ولی باید هر بار دیده شود.
process.stdout.write('\n▶ گیت قانون اساسی (اطلاع‌رسانی، نه مسدودکننده)\n');
spawnSync('npm', ['run', 'gate'], { stdio: 'inherit', shell: true });

if (failed !== null) {
  process.stderr.write(`\n❌ «${failed}» شکست خورد — کامیت نکن.\n`);
  process.exit(1);
}

process.stdout.write('\n✅ همهٔ دروازه‌ها باز.\n');

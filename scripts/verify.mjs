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
import { existsSync, readFileSync } from 'node:fs';
import { connect } from 'node:net';

/**
 * بررسی پیش‌پرواز: آیا پایگاه دادهٔ آزمون در دسترس است.
 *
 * چرا وجود دارد: دو بار مجموعهٔ آزمون وسط اجرا قرمز شد و هر بار وقت رفت تا
 * معلوم شود **داکر دسکتاپ بسته شده** و Postgres با آن رفته. Vitest شکستِ
 * `beforeAll` را «skipped» گزارش می‌کند که کاملاً گمراه‌کننده است.
 *
 * اینجا **پیش از** اجرای هر آزمونی معلوم می‌شود، با پیامی که می‌شود رویش
 * عمل کرد.
 */
async function checkTestDatabase() {
  const envFile = 'apps/core/.env';
  if (!existsSync(envFile)) return null;
  const match = /^TEST_DATABASE_URL="?([^"\n]+)"?/m.exec(readFileSync(envFile, 'utf8'));
  if (match?.[1] === undefined) return null;

  const url = new URL(match[1]);
  const port = Number(url.port || 5432);
  const host = url.hostname;

  const reachable = await new Promise((resolve) => {
    const socket = connect({ host, port, timeout: 3000 });
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('error', () => resolve(false));
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
  });

  return reachable ? null : `${host}:${port}`;
}

const unreachable = await checkTestDatabase();
if (unreachable !== null) {
  process.stderr.write(
    [
      '',
      `❌ پایگاه دادهٔ آزمون روی ${unreachable} در دسترس نیست.`,
      '',
      'محتمل‌ترین علت: داکر دسکتاپ بسته شده و کانتینر Postgres با آن رفته.',
      'راه‌حل: داکر دسکتاپ را باز کن، بعد `docker compose up -d`.',
      '',
      'بدون آن، آزمون‌های یکپارچه «skipped» گزارش می‌شوند و علتش پیدا نیست.',
      '',
    ].join('\n'),
  );
  process.exit(1);
}

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

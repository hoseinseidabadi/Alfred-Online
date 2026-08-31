#!/usr/bin/env node
/**
 * نگهبان گیت قانون اساسی.
 *
 * بخش «تاب‌آوری و آزمون» قانون اساسی پنج آزمون را الزام کرده و SC-004 آزمون
 * اجراشدنی می‌خواهد. `vitest run` وقتی فایلی پیدا نکند خطا نمی‌دهد — یعنی نبودِ
 * این شش آزمون می‌تواند بی‌صدا از گیت رد شود. این اسکریپت دقیقاً همان را می‌بندد.
 */
import { existsSync, statSync } from 'node:fs';

const REQUIRED = [
  [
    '۱',
    'ثبت با هستهٔ در دسترس نبودن',
    'V-4',
    'T042',
    'apps/edge/tests/resilience/v4-submit-core-down.test.ts',
  ],
  [
    '۲',
    'یکتایی شماره پس از بازراه‌اندازی',
    'V-7',
    'T032',
    'apps/edge/tests/resilience/v7-counter-uniqueness.test.ts',
  ],
  [
    '۳',
    'تحویل صف پس از بازگشت ارتباط',
    'V-5',
    'T045',
    'apps/edge/tests/resilience/v5-queue-drain.test.ts',
  ],
  [
    '۴',
    'بقای گفت‌وگوی نیمه‌تمام',
    'V-6',
    'T037',
    'apps/edge/tests/resilience/v6-conversation-survival.test.ts',
  ],
  [
    '۵',
    'هشدار پیش از نقض تعهد',
    'V-8',
    'T024',
    'apps/core/tests/resilience/v8-deadline-warning.test.ts',
  ],
  [
    'SC-004',
    'قطعی ۷۲ ساعته، صفر گم‌شدگی',
    'V-11',
    'T046',
    'apps/edge/tests/resilience/v11-72h-outage.test.ts',
  ],
];

const missing = [];
console.log('\nگیت قانون اساسی — آزمون‌های تاب‌آوری الزامی\n');

for (const [n, title, scenario, task, path] of REQUIRED) {
  const present = existsSync(path) && statSync(path).size > 0;
  if (!present) missing.push([task, path]);
  console.log(`  ${present ? '✅' : '⏳'}  ${n.padEnd(6)} ${title}  ·  ${scenario}  ·  ${task}`);
}

if (missing.length === 0) {
  console.log('\nهر شش آزمون الزامی موجودند.\n');
  process.exit(0);
}

console.error(`\n❌ ${missing.length} آزمون الزامی هنوز نوشته نشده است:\n`);
for (const [task, path] of missing) console.error(`     ${task} → ${path}`);
console.error(
  '\nاین قرمزی عمدی است. تا نوشته شدن این آزمون‌ها گیت باز نمی‌شود —',
  '\nبند «تاب‌آوری و آزمون» قانون اساسی، که بر پیش‌فرض «تست‌ها اختیاری» غلبه دارد.\n',
);
process.exit(1);

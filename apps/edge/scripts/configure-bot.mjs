#!/usr/bin/env node
/**
 * پیکربندی نمای ربات در تلگرام.
 *
 * چرا لازم است: کاربر در تست واقعی گفت «شروع یا لغو کردن سخت است و ممکن است
 * کاربر نداند باید /start یا /cancel بزند». دکمهٔ منوی تلگرام و متن معرفی،
 * این را بدون اینکه چیزی حفظ شود حل می‌کنند.
 *
 * یک بار اجرا می‌شود و روی حساب ربات می‌ماند — بخشی از استقرار نیست.
 * اجرا: `node scripts/configure-bot.mjs`
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const envFile = resolve(import.meta.dirname, '..', '.dev.vars');
if (existsSync(envFile)) process.loadEnvFile(envFile);

const token = process.env.TELEGRAM_TOKEN;
if (!token) {
  console.error('TELEGRAM_TOKEN پیدا نشد — apps/edge/.dev.vars را بساز.');
  process.exit(1);
}

const call = async (method, body) => {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  console.log(`${json.ok ? '✅' : '❌'} ${method}${json.ok ? '' : ` — ${json.description}`}`);
  return json.ok;
};

// منوی دستورها — در دکمهٔ کنار جعبهٔ تایپ دیده می‌شود.
await call('setMyCommands', {
  commands: [
    { command: 'start', description: 'ثبت درخواست تازه' },
    { command: 'cancel', description: 'لغو ثبتی که وسطش هستی' },
    { command: 'help', description: 'راهنما' },
  ],
  scope: { type: 'all_private_chats' },
  language_code: 'fa',
});

// متنی که پیش از اولین پیام، در گفت‌وگوی خالی دیده می‌شود.
await call('setMyDescription', {
  description:
    'اینجا می‌توانی خرابی، درخواست بهبود یا ایدهٔ تازه ثبت کنی. ' +
    'چند سوال کوتاه می‌پرسم و در پایان یک شمارهٔ پیگیری می‌گیری. ' +
    'حداکثر تا هفت روز پاسخ مکتوب می‌گیری — حتی اگر جواب «نه» باشد.',
  language_code: 'fa',
});

// متن کوتاه زیر نام ربات در فهرست گفت‌وگوها.
await call('setMyShortDescription', {
  short_description: 'ثبت درخواست‌های محصول — پاسخ مکتوب تا هفت روز',
  language_code: 'fa',
});

// دکمهٔ منو روی «دستورها» تا کاربر بدون حفظ کردن، /start را ببیند.
await call('setChatMenuButton', { menu_button: { type: 'commands' } });

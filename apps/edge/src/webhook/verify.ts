/**
 * راستی‌آزمایی webhook تلگرام — R-06.
 *
 * این نقطهٔ ورود **عمومی** سامانه است. بدون این بررسی، هرکسی که نشانی Worker را
 * بداند می‌تواند رویداد جعلی بفرستد و از طرف دیگران درخواست ثبت کند.
 *
 * webhook با `secret_token` ثبت می‌شود و تلگرام آن را در هدر
 * `X-Telegram-Bot-Api-Secret-Token` روی هر درخواست می‌گذارد.
 *
 * راز فقط از Secret Store می‌آید، هرگز از ریپو (بند «اسرار و دسترسی»).
 */

/** هدری که تلگرام راز را در آن می‌گذارد. */
export const TELEGRAM_SECRET_HEADER = 'x-telegram-bot-api-secret-token';

export type WebhookVerdict =
  { ok: true } | { ok: false; reason: 'missing_secret' | 'missing_header' | 'mismatch' };

const encoder = new TextEncoder();

/**
 * درخواست ورودی را در برابر راز پیکربندی‌شده می‌سنجد.
 *
 * سه حالتِ رد از هم جدا نگه داشته می‌شوند چون **یکی از آن‌ها خرابی پیکربندی
 * ماست، نه حملهٔ کسی**: اگر `WEBHOOK_SECRET` تنظیم نشده باشد، هر درخواستی رد
 * می‌شود و از بیرون شبیه حمله به‌نظر می‌رسد. بدون این تفکیک، یک استقرارِ
 * بدون‌راز به‌صورت «ربات جواب نمی‌دهد» ظاهر می‌شود و ساعت‌ها وقت می‌برد.
 */
export function verifyTelegramWebhook(request: Request, secret: string): WebhookVerdict {
  if (secret.length === 0) return { ok: false, reason: 'missing_secret' };

  const presented = request.headers.get(TELEGRAM_SECRET_HEADER);
  if (presented === null || presented.length === 0) {
    return { ok: false, reason: 'missing_header' };
  }

  return safeEqual(presented, secret) ? { ok: true } : { ok: false, reason: 'mismatch' };
}

/**
 * مقایسهٔ مقاوم به حملهٔ زمانی.
 *
 * `===` روی رشته در اولین بایت متفاوت برمی‌گردد و طول زمان پاسخ، راز را بایت
 * به بایت لو می‌دهد. `crypto.subtle.timingSafeEqual` زمان ثابت دارد.
 *
 * طول‌های نابرابر پیش از مقایسه رد می‌شوند — خودِ `timingSafeEqual` روی طول
 * متفاوت خطا می‌دهد، و طولِ راز چیزی نیست که پنهان نگهش داریم.
 */
function safeEqual(a: string, b: string): boolean {
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  if (left.byteLength !== right.byteLength) return false;
  return crypto.subtle.timingSafeEqual(left, right);
}

/**
 * پاسخ استاندارد رد.
 *
 * عمداً `401` بدون هیچ توضیحی: به فرستندهٔ ناشناس نمی‌گوییم چرا رد شد. دلیل
 * دقیق فقط در لاگ سمت ما می‌ماند.
 */
export function unauthorizedResponse(): Response {
  return new Response(null, { status: 401 });
}

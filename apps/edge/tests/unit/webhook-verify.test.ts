import { describe, expect, it } from 'vitest';
import { TELEGRAM_SECRET_HEADER, verifyTelegramWebhook } from '../../src/webhook/verify';

const SECRET = 'a-very-secret-token-value';

const requestWith = (headers: Record<string, string> = {}): Request =>
  new Request('https://edge.example/telegram/webhook', { method: 'POST', headers });

describe('verifyTelegramWebhook', () => {
  it('درخواست با راز درست را می‌پذیرد', () => {
    const verdict = verifyTelegramWebhook(
      requestWith({ [TELEGRAM_SECRET_HEADER]: SECRET }),
      SECRET,
    );
    expect(verdict).toEqual({ ok: true });
  });

  it('درخواست بدون هدر را رد می‌کند', () => {
    expect(verifyTelegramWebhook(requestWith(), SECRET)).toEqual({
      ok: false,
      reason: 'missing_header',
    });
  });

  it('هدر خالی را مثل نبودنش رد می‌کند', () => {
    expect(verifyTelegramWebhook(requestWith({ [TELEGRAM_SECRET_HEADER]: '' }), SECRET)).toEqual({
      ok: false,
      reason: 'missing_header',
    });
  });

  it('راز اشتباه را رد می‌کند', () => {
    expect(
      verifyTelegramWebhook(requestWith({ [TELEGRAM_SECRET_HEADER]: 'wrong' }), SECRET),
    ).toEqual({ ok: false, reason: 'mismatch' });
  });

  it('رازی که فقط یک بایت فرق دارد را هم رد می‌کند', () => {
    const almost = SECRET.slice(0, -1) + 'X';
    expect(
      verifyTelegramWebhook(requestWith({ [TELEGRAM_SECRET_HEADER]: almost }), SECRET),
    ).toEqual({ ok: false, reason: 'mismatch' });
  });

  it('پیشوندِ راز درست را نمی‌پذیرد', () => {
    expect(
      verifyTelegramWebhook(requestWith({ [TELEGRAM_SECRET_HEADER]: SECRET.slice(0, 5) }), SECRET),
    ).toEqual({ ok: false, reason: 'mismatch' });
  });

  it('نام هدر به بزرگی و کوچکی حروف حساس نیست', () => {
    const verdict = verifyTelegramWebhook(
      requestWith({ 'X-Telegram-Bot-Api-Secret-Token': SECRET }),
      SECRET,
    );
    expect(verdict).toEqual({ ok: true });
  });

  it('رازِ ۲۵۶ کاراکتری — بیشینهٔ مجاز تلگرام', () => {
    // تلگرام برای `secret_token` فقط `A-Z a-z 0-9 _ -` و حداکثر ۲۵۶ کاراکتر
    // می‌پذیرد، پس رازِ چندبایتی سناریوی ممکنی نیست و آزمونش ارزشی ندارد.
    const longest = 'a'.repeat(255) + '_';
    expect(longest).toHaveLength(256);
    expect(
      verifyTelegramWebhook(requestWith({ [TELEGRAM_SECRET_HEADER]: longest }), longest),
    ).toEqual({ ok: true });
  });

  it('راز تنظیم‌نشده را از حملهٔ کسی جدا گزارش می‌کند', () => {
    // این خرابی پیکربندی ماست، نه حمله. اگر با `mismatch` قاطی شود، یک
    // استقرارِ بدون‌راز به‌صورت «ربات جواب نمی‌دهد» ظاهر می‌شود.
    expect(verifyTelegramWebhook(requestWith({ [TELEGRAM_SECRET_HEADER]: SECRET }), '')).toEqual({
      ok: false,
      reason: 'missing_secret',
    });
  });
});

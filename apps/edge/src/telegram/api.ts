/**
 * کلاینت نازک Bot API تلگرام.
 *
 * عمداً کوچک و بی‌منطق است: فقط تماس می‌گیرد و پاسخ خام را برمی‌گرداند.
 * تصمیم دربارهٔ معنای پاسخ جای دیگری است — `access/membership.ts` برای
 * دسترسی، `telegram/adapter.ts` برای ارسال.
 *
 * **تفکیک مهم**: خطای شبکه از پاسخ منفی جدا نگه داشته می‌شود. برای دسترسی،
 * «این آدم عضو نیست» و «تلگرام الان جواب نمی‌دهد» دو چیز کاملاً متفاوت‌اند و
 * قاطی کردنشان یعنی در هر قطعی گذرا یا همه را عضو حساب کنیم یا همه را بیرون.
 */

const API_BASE = 'https://api.telegram.org';

/** پاسخ موفق Bot API. */
export interface TelegramOk<T> {
  outcome: 'ok';
  result: T;
}

/** تلگرام جواب داد ولی درخواست را رد کرد — یک واقعیت، نه خرابی. */
export interface TelegramRejected {
  outcome: 'rejected';
  errorCode: number;
  description: string;
}

/** تلگرام اصلاً جواب نداد یا خراب بود — هیچ چیزی دربارهٔ واقعیت نمی‌گوید. */
export interface TelegramUnavailable {
  outcome: 'unavailable';
  reason: string;
  /** اگر `429` بود، چند ثانیه باید صبر کرد. */
  retryAfterSeconds?: number;
}

export type TelegramResult<T> = TelegramOk<T> | TelegramRejected | TelegramUnavailable;

interface RawEnvelope {
  ok: boolean;
  result?: unknown;
  error_code?: number;
  description?: string;
  parameters?: { retry_after?: number };
}

/** یک متد Bot API را صدا می‌زند. */
export async function callTelegram<T>(
  token: string,
  method: string,
  params: Record<string, string | number | boolean> = {},
  fetchImpl: typeof fetch = fetch,
): Promise<TelegramResult<T>> {
  let response: Response;
  try {
    response = await fetchImpl(`${API_BASE}/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(params),
    });
  } catch (error) {
    return { outcome: 'unavailable', reason: describe(error) };
  }

  // ۵xx یعنی خرابی سمت تلگرام — دربارهٔ درخواست ما چیزی نمی‌گوید.
  if (response.status >= 500) {
    return { outcome: 'unavailable', reason: `HTTP ${response.status}` };
  }

  let envelope: RawEnvelope;
  try {
    envelope = (await response.json()) as RawEnvelope;
  } catch (error) {
    return { outcome: 'unavailable', reason: `پاسخ نامعتبر: ${describe(error)}` };
  }

  if (envelope.ok) return { outcome: 'ok', result: envelope.result as T };

  // ۴۲۹ محدودیت نرخ است، نه پاسخ منفی — بعداً باید دوباره پرسید.
  if (envelope.error_code === 429) {
    return {
      outcome: 'unavailable',
      reason: 'محدودیت نرخ',
      retryAfterSeconds: envelope.parameters?.retry_after ?? 1,
    };
  }

  return {
    outcome: 'rejected',
    errorCode: envelope.error_code ?? response.status,
    description: envelope.description ?? 'بدون توضیح',
  };
}

// ── انواع پاسخ‌هایی که استفاده می‌کنیم ──────────────────────────────────────

/**
 * وضعیت‌های عضویت که Bot API برمی‌گرداند.
 * `restricted` در کانال عملاً رخ نمی‌دهد ولی برای ایمنی پوشش داده شده.
 */
export type ChatMemberStatus =
  'creator' | 'administrator' | 'member' | 'restricted' | 'left' | 'kicked';

export interface ChatMember {
  status: ChatMemberStatus;
  user: { id: number; is_bot: boolean; first_name: string; username?: string };
}

export function getChatMember(
  token: string,
  chatId: string,
  userId: number,
  fetchImpl?: typeof fetch,
): Promise<TelegramResult<ChatMember>> {
  return callTelegram<ChatMember>(
    token,
    'getChatMember',
    { chat_id: chatId, user_id: userId },
    fetchImpl,
  );
}

export interface SentMessage {
  message_id: number;
  date: number;
}

export function sendMessage(
  token: string,
  chatId: string,
  text: string,
  extra: Record<string, string | number | boolean> = {},
  fetchImpl?: typeof fetch,
): Promise<TelegramResult<SentMessage>> {
  return callTelegram<SentMessage>(
    token,
    'sendMessage',
    { chat_id: chatId, text, ...extra },
    fetchImpl,
  );
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

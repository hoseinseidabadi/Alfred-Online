import { type Choice } from '../conversation/questions';
import { type TelegramResult, sendMessage } from './api';

/**
 * آداپتور مقصد پیام — R-13.
 *
 * الگو از Campaign Studio بازاستفاده شده، نه کدش. `Capabilities.md` مخزن دانش
 * صریحاً این الگو را قابل‌بازاستفاده علامت زده.
 *
 * **چرا این لایه وجود دارد**: منطق ثبت نباید به تلگرام گره بخورد. اگر فردا
 * «بله» یا هر مقصد دیگری لازم شد، یک پیاده‌سازی تازهٔ همین رابط کافی است و
 * `conversation/` و `submission/` دست نمی‌خورند.
 *
 * این ادعا وقتی معنا دارد که رابط **از جنس مقصد نباشد**: اینجا نه از
 * `chat_id` تلگرام حرفی هست نه از `reply_markup`. فقط «به این گیرنده، این
 * متن، با این گزینه‌ها».
 */

export interface OutboundMessage {
  /** شناسهٔ گیرنده در همان مقصد. */
  recipient: string;
  text: string;
  /** اگر باشد، گیرنده به‌جای تایپ، یکی را انتخاب می‌کند (FR-010). */
  choices?: readonly Choice[];
}

export type DeliveryResult =
  { delivered: true } | { delivered: false; permanent: boolean; reason: string };

export interface DestinationAdapter {
  readonly name: string;
  send(message: OutboundMessage): Promise<DeliveryResult>;
}

/**
 * خطاهایی که تلاش دوباره درستشان نمی‌کند.
 *
 * `403` یعنی کاربر ربات را بلاک کرده یا گفت‌وگو را پاک کرده. این مورد
 * جداگانه اهمیت دارد: پاسخ تریاژ از همین مسیر می‌رود و اگر «موقت» تفسیر شود،
 * برای همیشه در صف می‌ماند و تعهد هفت‌روزه بی‌صدا نقض می‌شود.
 */
const PERMANENT_ERROR_CODES = new Set([400, 403]);

export class TelegramAdapter implements DestinationAdapter {
  readonly name = 'telegram';

  constructor(
    private readonly token: string,
    private readonly fetchImpl?: typeof fetch,
  ) {}

  async send(message: OutboundMessage): Promise<DeliveryResult> {
    const extra: Record<string, string> =
      message.choices === undefined || message.choices.length === 0
        ? {}
        : { reply_markup: JSON.stringify(keyboardFor(message.choices)) };

    return toDeliveryResult(
      await sendMessage(this.token, message.recipient, message.text, extra, this.fetchImpl),
    );
  }
}

/** گزینه‌ها را به صفحه‌کلید تلگرام تبدیل می‌کند — یک گزینه در هر ردیف. */
function keyboardFor(choices: readonly Choice[]) {
  return {
    inline_keyboard: choices.map((choice) => [{ text: choice.label, callback_data: choice.value }]),
  };
}

export function toDeliveryResult(result: TelegramResult<unknown>): DeliveryResult {
  switch (result.outcome) {
    case 'ok':
      return { delivered: true };
    case 'rejected':
      return {
        delivered: false,
        permanent: PERMANENT_ERROR_CODES.has(result.errorCode),
        reason: `${result.errorCode}: ${result.description}`,
      };
    case 'unavailable':
      // خرابی گذرا — صف نگهش می‌دارد و بعداً دوباره تلاش می‌کند.
      return { delivered: false, permanent: false, reason: result.reason };
  }
}

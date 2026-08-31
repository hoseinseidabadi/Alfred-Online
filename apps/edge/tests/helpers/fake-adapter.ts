import type {
  DeliveryResult,
  DestinationAdapter,
  OutboundMessage,
} from '../../src/telegram/adapter';

/**
 * مقصد ساختگی — پیام‌ها را نگه می‌دارد به‌جای اینکه بفرستد.
 *
 * وجود این کلاس خودش گواه ارزش الگوی آداپتور (R-13) است: آزمون سرتاسری بدون
 * هیچ تلگرامی اجرا می‌شود، چون منطق ثبت اصلاً نمی‌داند مقصدش کجاست.
 */
export class FakeAdapter implements DestinationAdapter {
  readonly name = 'fake';
  readonly sent: OutboundMessage[] = [];

  /** اگر ست شود، ارسال بعدی شکست می‌خورد. */
  failNext: DeliveryResult | null = null;

  async send(message: OutboundMessage): Promise<DeliveryResult> {
    this.sent.push(message);
    if (this.failNext !== null) {
      const result = this.failNext;
      this.failNext = null;
      return result;
    }
    return { delivered: true };
  }

  /** متن آخرین پیام. */
  get lastText(): string {
    return this.sent[this.sent.length - 1]?.text ?? '';
  }

  /** گزینه‌های آخرین پیام، اگر داشت. */
  get lastChoices(): string[] {
    return (this.sent[this.sent.length - 1]?.choices ?? []).map((c) => c.value);
  }

  /** همهٔ متن‌ها، برای ادعاهایی که به کل گفت‌وگو نگاه می‌کنند. */
  get allText(): string {
    return this.sent.map((m) => m.text).join('\n---\n');
  }

  clear(): void {
    this.sent.length = 0;
  }
}

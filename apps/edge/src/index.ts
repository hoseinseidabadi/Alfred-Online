import type { Env } from './env';

export { CounterDO } from './counter/counter.do';
export { ConversationDO } from './conversation/conversation.do';

/**
 * نقطهٔ ورود لبه.
 * `fetch`     → webhook تلگرام (T022 راستی‌آزمایی · T040 مسیریابی)
 * `scheduled` → چرخهٔ پل: outbox (T043) و inbox (T065)
 */
export default {
  async fetch(request: Request, _env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return Response.json({ ok: true, layer: 'edge' });
    }

    if (url.pathname === '/telegram/webhook') {
      // T022 → T040
      return new Response('webhook — پیاده‌سازی در T022 و T040', { status: 501 });
    }

    return new Response('یافت نشد', { status: 404 });
  },

  async scheduled(_event: ScheduledController, _env: Env): Promise<void> {
    // T044: outbox (T043) سپس inbox (T065)
  },
} satisfies ExportedHandler<Env>;

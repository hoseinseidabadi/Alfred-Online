import { runBridgeCycle } from './bridge/cron';
import type { Env } from './env';
import { TelegramAdapter } from './telegram/adapter';
import { handleUpdate } from './webhook/router';
import type { TelegramUpdate } from './webhook/update';
import { unauthorizedResponse, verifyTelegramWebhook } from './webhook/verify';

export { CounterDO } from './counter/counter.do';
export { ConversationDO } from './conversation/conversation.do';

/**
 * نقطهٔ ورود لبه.
 *
 * `fetch`     → webhook تلگرام (T022 راستی‌آزمایی · T040 مسیریابی)
 * `scheduled` → چرخهٔ پل (T044)
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return Response.json({ ok: true, layer: 'edge', environment: env.ENVIRONMENT });
    }

    if (url.pathname !== '/telegram/webhook') {
      return new Response('یافت نشد', { status: 404 });
    }
    if (request.method !== 'POST') {
      return new Response('روش مجاز نیست', { status: 405 });
    }

    const verdict = verifyTelegramWebhook(request, env.WEBHOOK_SECRET);
    if (!verdict.ok) {
      // دلیل دقیق فقط در لاگ ما می‌ماند؛ به فرستندهٔ ناشناس گفته نمی‌شود.
      console.warn(`webhook رد شد: ${verdict.reason}`);
      return unauthorizedResponse();
    }

    let update: TelegramUpdate;
    try {
      update = (await request.json()) as TelegramUpdate;
    } catch {
      // بدنهٔ خراب — ۲۰۰ می‌دهیم تا تلگرام دوباره نفرستد.
      return new Response(null, { status: 200 });
    }

    // پردازش پس از پاسخ ادامه می‌یابد: تلگرام برای هر بروزرسانی مهلت کوتاهی
    // دارد و اگر منتظر بمانیم، همان بروزرسانی را دوباره می‌فرستد.
    ctx.waitUntil(handleUpdate(update, { env, adapter: new TelegramAdapter(env.TELEGRAM_TOKEN) }));
    return new Response(null, { status: 200 });
  },

  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runBridgeCycle(env));
  },
} satisfies ExportedHandler<Env>;

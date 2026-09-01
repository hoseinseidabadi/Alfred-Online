import { applyD1Migrations, env, runInDurableObject } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, inject, it, vi } from 'vitest';
import type { CounterDO } from '../../src/counter/counter.do';
import { handleUpdate } from '../../src/webhook/router';
import type { TelegramUpdate } from '../../src/webhook/update';
import { FakeAdapter } from '../helpers/fake-adapter';

/**
 * استعلام وضعیت با شمارهٔ پیگیری — FR-035.
 *
 * گزارش کاربر از تست واقعی:
 *   «شماره‌هایی که ثبت می‌شود، وقتی تایپ می‌کنم مثلاً REQ-4، می‌گوید شماره‌ای
 *    با این عنوان پیدا نکردم.»
 *
 * علتش این بود که مسیریاب یک پیام ثابت «پیدا نکردم» می‌داد و اصلاً جست‌وجو
 * نمی‌کرد — جای‌نگهدارِ T067 که به هسته نیاز داشت. ولی **لبه خودش رکورد را
 * دارد** و می‌تواند جواب بدهد؛ اصل III می‌گوید همین کار را بکند.
 */

const CHAT_ID = 265966801;
const OTHER_CHAT = 111222333;

const messageFrom = (chatId: number, text: string): TelegramUpdate => ({
  update_id: Math.floor(Math.random() * 1e9),
  message: {
    message_id: Math.floor(Math.random() * 1e6),
    from: { id: chatId, first_name: 'حسین' },
    chat: { id: chatId, type: 'private' },
    text,
  },
});

const memberOfChannel = () =>
  vi.spyOn(globalThis, 'fetch').mockImplementation(
    async () =>
      Response.json({
        ok: true,
        result: { status: 'member', user: { id: CHAT_ID, is_bot: false, first_name: 'حسین' } },
      }) as unknown as Response,
  );

describe('استعلام وضعیت — FR-035', () => {
  let adapter: FakeAdapter;

  beforeEach(async () => {
    await applyD1Migrations(env.DB, inject('d1Migrations'));
    await env.DB.prepare('DELETE FROM edge_submission').run();
    await runInDurableObject(
      env.COUNTER.get(env.COUNTER.idFromName('global')) as DurableObjectStub<CounterDO>,
      async (_i, state) => {
        await state.storage.deleteAll();
      },
    );
    for (const chat of [CHAT_ID, OTHER_CHAT]) {
      await runInDurableObject(
        env.CONVERSATION.get(env.CONVERSATION.idFromName(String(chat))),
        async (_i, state) => {
          await state.storage.deleteAll();
        },
      );
    }
    adapter = new FakeAdapter();
    memberOfChannel();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const send = (text: string, chatId = CHAT_ID) =>
    handleUpdate(messageFrom(chatId, text), { env, adapter });

  const submitOnce = async () => {
    await send('/start');
    await send('editorial');
    await send('bug');
    await send('وب‌سایت');
    await send('صفحهٔ خبر را باز کردم');
    await send('خطای ۵۰۲ داد');
    await send('this_week');
    await send('few_people');
    await send('خواننده صفحه را نمی‌بیند');
    await send('__done');
  };

  it('شمارهٔ موجود، وضعیت واقعی می‌دهد نه «پیدا نکردم»', async () => {
    await submitOnce();
    adapter.clear();

    await send('REQ-1');

    expect(adapter.lastText).toContain('REQ-1');
    expect(adapter.lastText).toContain('ثبت شده');
    expect(adapter.lastText).not.toContain('پیدا نکردم');
  });

  it('مهلت پاسخ را به تاریخ جلالی نشان می‌دهد', async () => {
    await submitOnce();
    adapter.clear();
    await send('REQ-1');

    expect(adapter.lastText).toContain('مهلت پاسخ');
    expect(adapter.lastText).toMatch(/[۰-۹]{4}\/[۰-۹]{2}\/[۰-۹]{2}/);
    expect(adapter.lastText).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it('روزهای باقی‌مانده با رقم فارسی می‌آید', async () => {
    await submitOnce();
    adapter.clear();
    await send('REQ-1');
    expect(adapter.lastText).toMatch(/[۰-۹]+ روز تا مهلت/);
  });

  it('حروف کوچک هم پذیرفته می‌شود', async () => {
    await submitOnce();
    adapter.clear();
    await send('req-1');
    expect(adapter.lastText).toContain('ثبت شده');
  });

  it('شمارهٔ ناموجود پیام روشن می‌گیرد', async () => {
    await send('REQ-999');
    expect(adapter.lastText).toContain('پیدا نکردم');
    expect(adapter.lastText).toContain('REQ-4');
  });

  it('کسی نمی‌تواند وضعیت ثبت دیگری را ببیند', async () => {
    // شمارهٔ پیگیری قابل حدس است (REQ-1، REQ-2…). بدون تطبیق chatId، هر کسی
    // می‌توانست ثبت‌های بقیه را استعلام کند.
    await submitOnce();
    adapter.clear();

    await send('REQ-1', OTHER_CHAT);

    expect(adapter.lastText).toContain('پیدا نکردم');
    expect(adapter.lastText).not.toContain('ثبت شده');
  });
});

import { applyD1Migrations, env, runInDurableObject } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, inject, it, vi } from 'vitest';
import type { ConversationDO } from '../../src/conversation/conversation.do';
import type { CounterDO } from '../../src/counter/counter.do';
import { pendingCount } from '../../src/submission/store';
import { handleUpdate } from '../../src/webhook/router';
import type { TelegramUpdate } from '../../src/webhook/update';
import { FakeAdapter } from '../helpers/fake-adapter';

/**
 * پیام بی‌ربط وقتی هیچ گفت‌وگویی در جریان نیست.
 *
 * گزارش کاربر از تست واقعی روی کانال تستی:
 *   «اگه وسط کار یک پیام الکی بفرستم، جایی که اصلاً هیچ فرآیندی شروع نشده،
 *    ربات می‌گوید "جواب خالی بود" و بلافاصله پرسش پیوست را می‌آورد. و اگر
 *    "تمام" را بزنم یک درخواست بی‌ربط ثبت می‌شود.»
 *
 * سه نقص پشت این رفتار بود و هر سه اینجا قفل می‌شوند.
 */

const CHAT_ID = 265966801;

const message = (text: string): TelegramUpdate => ({
  update_id: Math.floor(Math.random() * 1e9),
  message: {
    message_id: Math.floor(Math.random() * 1e6),
    from: { id: CHAT_ID, first_name: 'حسین' },
    chat: { id: CHAT_ID, type: 'private' },
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

describe('پیام بی‌ربط بیرون از گفت‌وگو', () => {
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
    await runInDurableObject(
      env.CONVERSATION.get(env.CONVERSATION.idFromName(String(CHAT_ID))),
      async (_i, state) => {
        await state.storage.deleteAll();
      },
    );
    adapter = new FakeAdapter();
    memberOfChannel();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const send = (text: string) => handleUpdate(message(text), { env, adapter });

  const fullSubmission = async () => {
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

  it('نقص ۱ — پیام بی‌ربط نباید «جواب خالی بود» بگیرد', async () => {
    await send('سلام');
    expect(adapter.allText).not.toContain('جواب خالی بود');
  });

  it('نقص ۲ — پیام بی‌ربط نباید پرسش پیوست را بیاورد', async () => {
    await send('سلام');
    expect(adapter.allText).not.toContain('تصویر، فایل یا لینکی');
  });

  it('پیام بی‌ربط باید راهنمای شروع بدهد', async () => {
    await send('سلام');
    expect(adapter.lastText).toContain('/start');
  });

  it('نقص ۳ — پس از یک ثبت موفق، پیام بی‌ربط + «تمام» نباید ثبت تازه بسازد', async () => {
    // این همان چیزی است که کاربر دید: پاسخ‌های ثبت قبلی هنوز در حالت مانده
    // بودند، پس «تمام» دوباره همان‌ها را ثبت می‌کرد.
    await fullSubmission();
    expect(await pendingCount(env.DB)).toBe(1);

    adapter.clear();
    await send('یک پیام الکی');
    await send('__done');

    expect(await pendingCount(env.DB)).toBe(1);
  });

  it('پس از ثبت، پاسخ‌های قبلی در حالت نمی‌مانند', async () => {
    await fullSubmission();
    const conversation = env.CONVERSATION.get(
      env.CONVERSATION.idFromName(String(CHAT_ID)),
    ) as DurableObjectStub<ConversationDO>;
    const snapshot = await conversation.snapshot();
    expect(snapshot.state.answers).toEqual({});
    expect(snapshot.state.requestType).toBeUndefined();
    // ولی واحد سازمانی می‌ماند — FR-003.
    expect(snapshot.state.unit).toBe('editorial');
  });

  it('«تمام» بیرون از گام پیوست هیچ ثبتی نمی‌سازد', async () => {
    await send('__done');
    expect(await pendingCount(env.DB)).toBe(0);
    expect(adapter.lastText).toContain('/start');
  });
});

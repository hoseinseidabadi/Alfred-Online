import { applyD1Migrations, env, runInDurableObject } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, inject, it, vi } from 'vitest';
import { pendingCount } from '../../src/submission/store';
import { handleUpdate } from '../../src/webhook/router';
import type { TelegramUpdate } from '../../src/webhook/update';
import { FakeAdapter } from '../helpers/fake-adapter';

/**
 * سناریوی **V-3** در `quickstart.md` — T048.
 *
 *   «از حسابی که عضو کانال نیست تلاش کن → انتظار: ثبت انجام نمی‌شود؛ پیام
 *    راهنما می‌آید.»
 *
 * به‌علاوهٔ چیزی که V-3 نمی‌گوید ولی spike S-1 اثباتش کرد و **مهم‌تر است**:
 * وقتی وضعیت عضویت **نامعلوم** است (تلگرام خراب)، رفتار باید با «غیرعضو»
 * فرق کند. به کسی که عضو هست نباید گفت «عضو نیستی».
 */

const CHAT_ID = 999000111;

const message = (text: string): TelegramUpdate => ({
  update_id: Math.floor(Math.random() * 1e9),
  message: {
    message_id: Math.floor(Math.random() * 1e6),
    from: { id: CHAT_ID, first_name: 'ناشناس' },
    chat: { id: CHAT_ID, type: 'private' },
    text,
  },
});

/** تلگرام: این کاربر کانال را ترک کرده — پاسخ منفیِ قطعی. */
const notMember = () =>
  vi.spyOn(globalThis, 'fetch').mockImplementation(
    async () =>
      Response.json({
        ok: true,
        result: { status: 'left', user: { id: CHAT_ID, is_bot: false, first_name: 'ناشناس' } },
      }) as unknown as Response,
  );

/** تلگرام اصلاً جواب نمی‌دهد — نه «نه»، بلکه «نمی‌دانم». */
const telegramDown = () =>
  vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
    throw new Error('connect ETIMEDOUT');
  });

describe('V-3 — غیرعضو', () => {
  let adapter: FakeAdapter;

  beforeEach(async () => {
    await applyD1Migrations(env.DB, inject('d1Migrations'));
    await env.DB.prepare('DELETE FROM edge_submission').run();
    await runInDurableObject(
      env.CONVERSATION.get(env.CONVERSATION.idFromName(String(CHAT_ID))),
      async (_i, state) => {
        await state.storage.deleteAll();
      },
    );
    adapter = new FakeAdapter();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const send = (text: string) => handleUpdate(message(text), { env, adapter });

  it('سناریوی V-3 — ثبت انجام نمی‌شود و پیام راهنما می‌آید', async () => {
    notMember();

    await send('/start');

    expect(adapter.lastText).toContain('عضو کانال');
    expect(adapter.lastText).toContain('واحد محصول');
    expect(await pendingCount(env.DB)).toBe(0);
  });

  it('غیرعضو حتی نمی‌تواند وارد گفت‌وگو شود', async () => {
    notMember();

    await send('/start');
    await send('editorial');
    await send('bug');

    // هیچ پرسشی مطرح نشده — همان پیام راهنما تکرار شده.
    expect(adapter.sent).toHaveLength(3);
    expect(adapter.allText).not.toContain('در کدام واحد');
    expect(await pendingCount(env.DB)).toBe(0);
  });

  it('حتی /help هم برای غیرعضو باز نیست', async () => {
    notMember();
    await send('/help');
    expect(adapter.lastText).toContain('عضو کانال');
  });

  it('وقتی تلگرام خراب است، به کاربر گفته نمی‌شود «عضو نیستی»', async () => {
    // این تفکیک از spike S-1 می‌آید و در متن هم باید دیده شود: کاربری که
    // واقعاً عضو است نباید پیام «عضو نیستی» بگیرد فقط چون تلگرام لحظه‌ای
    // جواب نداد.
    telegramDown();

    await send('/start');

    expect(adapter.lastText).not.toContain('عضو کانال اطلاع‌رسانی محصول باشی');
    expect(adapter.lastText).toContain('نمی‌توانم عضویتت را بررسی کنم');
  });

  it('حالت نامعلوم کش نمی‌شود — دفعهٔ بعد دوباره پرسیده می‌شود', async () => {
    const spy = telegramDown();
    await send('/start');
    const callsAfterFirst = spy.mock.calls.length;

    await send('/start');

    // اگر «نامعلوم» کش می‌شد، تماس دومی گرفته نمی‌شد و کاربر تا انقضای کش
    // بیرون می‌ماند.
    expect(spy.mock.calls.length).toBeGreaterThan(callsAfterFirst);
  });

  it('حکم قطعیِ «غیرعضو» کش می‌شود و تلگرام دوباره پرسیده نمی‌شود', async () => {
    const spy = notMember();
    await send('/start');
    const callsAfterFirst = spy.mock.calls.length;

    await send('/start');

    expect(spy.mock.calls.length).toBe(callsAfterFirst);
  });
});

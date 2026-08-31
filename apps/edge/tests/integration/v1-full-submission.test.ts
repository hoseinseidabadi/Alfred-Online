import { applyD1Migrations, env, runInDurableObject } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, inject, it, vi } from 'vitest';
import type { CounterDO } from '../../src/counter/counter.do';
import { findSubmission } from '../../src/submission/store';
import { handleUpdate } from '../../src/webhook/router';
import type { TelegramUpdate } from '../../src/webhook/update';
import { FakeAdapter } from '../helpers/fake-adapter';

/**
 * سناریوهای **V-1** و **V-2** در `quickstart.md` — T047.
 *
 * V-1 (US1 · SC-002): ثبت کامل → شمارهٔ `REQ-NNN` و تعهد هفت‌روزه؛
 *   `rawAnswers` در دیتابیس **عیناً** همان متن فارسی.
 * V-2 (US1 · FR-003): ثبت دوم با همان حساب → واحد سازمانی **پرسیده نمی‌شود**.
 *
 * این آزمون کل مسیر را از یک بروزرسانی خام تلگرام تا رکورد D1 طی می‌کند —
 * تنها جایی که راستی‌آزمایی می‌شود اجزا واقعاً به هم وصل‌اند.
 */

const CHAT_ID = 265966801;
const USER_ID = 265966801;

const message = (text: string): TelegramUpdate => ({
  update_id: Math.floor(Math.random() * 1e9),
  message: {
    message_id: Math.floor(Math.random() * 1e6),
    from: { id: USER_ID, first_name: 'حسین', last_name: 'سیدآبادی' },
    chat: { id: CHAT_ID, type: 'private' },
    text,
  },
});

/** تلگرامی که هر کاربر را عضو کانال می‌داند. */
const memberOfChannel = () =>
  vi.spyOn(globalThis, 'fetch').mockImplementation(
    async () =>
      Response.json({
        ok: true,
        result: { status: 'member', user: { id: USER_ID, is_bot: false, first_name: 'حسین' } },
      }) as unknown as Response,
  );

describe('V-1 و V-2 — ثبت کامل سرتاسری', () => {
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

  /** یک ثبت کامل خرابی، از `/start` تا شماره. */
  const fullBugSubmission = async () => {
    await send('/start');
    await send('editorial');
    await send('bug');
    await send('وب‌سایت');
    await send('صفحهٔ خبر رو باز کردم، ساعت شلوغی عصر');
    await send('خطای ۵۰۲ داد؛ انتظار داشتم خبر باز شود');
    await send('this_week');
    await send('few_people');
    await send('خواننده اصلاً صفحه را نمی‌بیند');
    await send('__done');
  };

  it('V-1 — ثبت کامل شمارهٔ پیگیری و تعهد هفت‌روزه می‌دهد', async () => {
    await fullBugSubmission();

    expect(adapter.lastText).toContain('REQ-1');
    expect(adapter.lastText).toContain('ثبت شد');
    // مهلت به تاریخ جلالی، نه میلادی.
    expect(adapter.lastText).toMatch(/[۰-۹]{4}\/[۰-۹]{2}\/[۰-۹]{2}/);
    expect(adapter.lastText).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it('V-1 — پاسخ‌های خام عیناً همان متن فارسی‌اند', async () => {
    await fullBugSubmission();

    const stored = await findSubmission(env.DB, 'REQ-1');
    expect(stored?.rawAnswers).toEqual({
      where: 'وب‌سایت',
      action: 'صفحهٔ خبر رو باز کردم، ساعت شلوغی عصر',
      observed: 'خطای ۵۰۲ داد؛ انتظار داشتم خبر باز شود',
      since: 'this_week',
      scope: 'few_people',
      roleQuestion: 'خواننده اصلاً صفحه را نمی‌بیند',
    });
  });

  it('V-1 — نوع درخواست و واحد ثبت‌کننده درست ذخیره شده‌اند', async () => {
    await fullBugSubmission();
    const stored = await findSubmission(env.DB, 'REQ-1');
    expect(stored?.requestType).toBe('bug');
    expect(stored?.unit).toBe('editorial');
    expect(stored?.submitterName).toBe('حسین سیدآبادی');
  });

  it('V-2 — ثبت دوم واحد سازمانی را دوباره نمی‌پرسد', async () => {
    await fullBugSubmission();
    adapter.clear();

    await send('/start');

    // اولین پرسشِ ثبت دوم باید «نوع» باشد، نه «واحد».
    expect(adapter.allText).not.toContain('در کدام واحد کار می‌کنی');
    expect(adapter.allText).toContain('چه چیزی می‌خواهی ثبت کنی');
  });

  it('ثبت دوم شمارهٔ تازه می‌گیرد و شمارهٔ اول را عوض نمی‌کند', async () => {
    await fullBugSubmission();
    await send('/start');
    await send('idea');
    await send('خلاصهٔ صوتی خبرها');
    await send('app_reader');
    await send('باید کل متن را بخواند');
    await send('user_said');
    await send('نرخ گوش‌دادن از ۵٪ بگذرد');
    await send('bit_harder');
    await send('خواننده در مسیر خبر را می‌شنود');
    await send('__done');

    expect(await findSubmission(env.DB, 'REQ-1')).not.toBeNull();
    expect(await findSubmission(env.DB, 'REQ-2')).not.toBeNull();
    expect((await findSubmission(env.DB, 'REQ-2'))?.requestType).toBe('idea');
  });

  it('پرسش نقش متناسب با واحد است — FR-009', async () => {
    await send('/start');
    await send('commercial');
    await send('improvement');
    await send('می‌خواهم گزارش آگهی‌ها را ببینم');
    await send('پنل بازرگانی');
    await send('الان اکسل دستی می‌سازم');
    await send('یک صفحه که خودش نشان بدهد');
    await send('weekly');

    // پرسش نقشِ بازرگانی، عیناً از منشور P-06.
    expect(adapter.lastText).toContain('آگهی‌دهندهٔ مشخصی');
  });

  it('گزینهٔ نامعتبر پذیرفته نمی‌شود و همان پرسش تکرار می‌شود', async () => {
    await send('/start');
    await send('editorial');
    await send('چیز دیگری'); // نوع درخواست گزینه‌ای است

    expect(adapter.allText).toContain('یکی از گزینه‌های بالا');
    expect(adapter.lastText).toContain('چه چیزی می‌خواهی ثبت کنی');
  });

  it('لغو، گفت‌وگو را بدون ثبت می‌بندد — سناریوی پذیرش ۷', async () => {
    await send('/start');
    await send('editorial');
    await send('bug');
    await send('وب‌سایت');
    await send('/cancel');

    expect(adapter.lastText).toContain('ثبت نشد');
    expect(await findSubmission(env.DB, 'REQ-1')).toBeNull();
  });

  it('شروع دوباره وسط گفت‌وگو، بی‌صدا جایگزین نمی‌کند', async () => {
    await send('/start');
    await send('editorial');
    await send('bug');
    await send('وب‌سایت');
    adapter.clear();

    await send('/start');

    expect(adapter.lastText).toContain('نیمه‌تمام');
    expect(adapter.lastChoices).toEqual(['__resume', '__restart']);
  });

  it('«ادامه می‌دهم» گفت‌وگو را از همان‌جا برمی‌گرداند', async () => {
    await send('/start');
    await send('editorial');
    await send('bug');
    await send('وب‌سایت');
    await send('/start');
    adapter.clear();

    await send('__resume');

    // پرسش دوم خرابی — همان‌جا که بودیم.
    expect(adapter.lastText).toContain('داشتی چه کار می‌کردی');
  });
});

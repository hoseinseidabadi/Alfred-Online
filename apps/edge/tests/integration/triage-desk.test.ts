import { applyD1Migrations, env, runInDurableObject } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, inject, it, vi } from 'vitest';
import type { CounterDO } from '../../src/counter/counter.do';
import { handleUpdate } from '../../src/webhook/router';
import type { TelegramUpdate } from '../../src/webhook/update';
import { FakeAdapter } from '../helpers/fake-adapter';

/**
 * میز تریاژ تلگرامی.
 *
 * چرا وجود دارد: تعهد سه‌روزهٔ خرابی فقط وقتی قابل نگه‌داشتن است که مدیر محصول
 * بتواند از گوشی تریاژ کند.
 *
 * **مهم‌ترین چیزی که این آزمون‌ها نگه می‌دارند**: مسیر سریع نباید سوراخِ
 * اصل IV شود. پاسخ رد بدون هر سه بخش، حتی از گوشی، ارسال نمی‌شود (FR-031).
 */

const PM = 265966801;
const SUBMITTER = 555111222;

const from = (chatId: number, text: string): TelegramUpdate => ({
  update_id: Math.floor(Math.random() * 1e9),
  message: {
    message_id: Math.floor(Math.random() * 1e6),
    from: { id: chatId, first_name: chatId === PM ? 'حسین' : 'مریم' },
    chat: { id: chatId, type: 'private' },
    text,
  },
});

const everyoneIsMember = () =>
  vi.spyOn(globalThis, 'fetch').mockImplementation(
    async () =>
      Response.json({
        ok: true,
        result: { status: 'member', user: { id: 1, is_bot: false, first_name: 'x' } },
      }) as unknown as Response,
  );

describe('میز تریاژ در تلگرام', () => {
  let adapter: FakeAdapter;
  let deps: { env: typeof env; adapter: FakeAdapter };

  beforeEach(async () => {
    await applyD1Migrations(env.DB, inject('d1Migrations'));
    for (const table of ['edge_submission', 'triage_decision']) {
      await env.DB.prepare(`DELETE FROM ${table}`).run();
    }
    await env.DB.prepare('UPDATE response_counter SET last_number = 0 WHERE id = 1').run();
    await runInDurableObject(
      env.COUNTER.get(env.COUNTER.idFromName('global')) as DurableObjectStub<CounterDO>,
      async (_i, state) => {
        await state.storage.deleteAll();
      },
    );
    for (const chat of [PM, SUBMITTER]) {
      await runInDurableObject(
        env.CONVERSATION.get(env.CONVERSATION.idFromName(String(chat))),
        async (_i, state) => {
          await state.storage.deleteAll();
        },
      );
    }
    adapter = new FakeAdapter();
    deps = { env, adapter };
    everyoneIsMember();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const send = (chatId: number, text: string) => handleUpdate(from(chatId, text), deps);

  /** یک خرابی از حساب ثبت‌کننده. */
  const submitBug = async () => {
    await send(SUBMITTER, '/start');
    await send(SUBMITTER, 'editorial');
    await send(SUBMITTER, 'bug');
    await send(SUBMITTER, 'وب‌سایت');
    await send(SUBMITTER, 'صفحهٔ خبر را باز کردم');
    await send(SUBMITTER, 'خطای ۵۰۲ داد');
    await send(SUBMITTER, 'today');
    await send(SUBMITTER, 'many');
    await send(SUBMITTER, 'خواننده صفحه را نمی‌بیند');
    await send(SUBMITTER, '__done');
  };

  const submitIdea = async () => {
    await send(SUBMITTER, '/start');
    await send(SUBMITTER, 'idea');
    await send(SUBMITTER, 'خلاصهٔ صوتی خبرها');
    await send(SUBMITTER, 'app_reader');
    await send(SUBMITTER, 'باید کل متن را بخواند');
    await send(SUBMITTER, 'user_said');
    await send(SUBMITTER, 'نرخ گوش‌دادن از ۵٪ بگذرد');
    await send(SUBMITTER, 'bit_harder');
    await send(SUBMITTER, 'خواننده در مسیر می‌شنود');
    await send(SUBMITTER, '__done');
  };

  const toPm = () => adapter.sent.filter((m) => m.recipient === String(PM));
  const toSubmitter = () => adapter.sent.filter((m) => m.recipient === String(SUBMITTER));

  describe('اعلان', () => {
    it('خرابی تازه بلافاصله به مدیر محصول می‌رسد', async () => {
      await submitBug();
      const alert = toPm().at(-1);
      expect(alert?.text).toContain('خرابی تازه ثبت شد');
      expect(alert?.text).toContain('REQ-1');
      expect(alert?.choices?.[0]?.value).toBe('__reply:REQ-1');
    });

    it('اعلان پاسخ‌های خام را عیناً نشان می‌دهد — اصل II', async () => {
      await submitBug();
      const alert = toPm().at(-1)?.text ?? '';
      expect(alert).toContain('خطای ۵۰۲ داد');
      expect(alert).toContain('خواننده صفحه را نمی‌بیند');
      // گزینه‌ها با برچسب فارسی، نه کلید خام.
      expect(alert).toContain('همین امروز');
    });

    it('اعلان مهلت سه‌روزهٔ خرابی را نشان می‌دهد', async () => {
      await submitBug();
      expect(toPm().at(-1)?.text).toMatch(/[۰-۹]+ روز تا مهلت|مهلت امروز/);
    });

    it('ایده اعلان فوری نمی‌گیرد — هفت روز مهلت دارد', async () => {
      await submitIdea();
      expect(toPm()).toHaveLength(0);
    });

    it('تأیید به ثبت‌کننده پیش از اعلان می‌رسد', async () => {
      // تعهد ما به ثبت‌کننده است، نه به میز تریاژ.
      await submitBug();
      const confirmIndex = adapter.sent.findIndex((m) => m.text.includes('ثبت شد ✅'));
      const alertIndex = adapter.sent.findIndex((m) => m.text.includes('خرابی تازه'));
      expect(confirmIndex).toBeLessThan(alertIndex);
    });
  });

  describe('پاسخ سریع — مسیر تبدیل', () => {
    it('پاسخ نوشته و همان لحظه به ثبت‌کننده می‌رسد', async () => {
      await submitBug();
      adapter.clear();

      await send(PM, '__reply:REQ-1');
      await send(PM, '__outcome:convert');
      await send(PM, 'دیدمش، مربوط به کش صفحه است. امروز درست می‌شود.');

      const delivered = toSubmitter().at(-1)?.text ?? '';
      expect(delivered).toContain('REQ-1 — بررسی شد ✅');
      expect(delivered).toContain('مربوط به کش صفحه است');

      expect(toPm().at(-1)?.text).toContain('RSP-0001');
    });

    it('تصمیم در صف هسته می‌نشیند با تأییدکننده', async () => {
      await submitBug();
      await send(PM, '__reply:REQ-1');
      await send(PM, '__outcome:convert');
      await send(PM, 'درست شد.');

      const row = await env.DB.prepare('SELECT * FROM triage_decision WHERE request_id = ?')
        .bind('REQ-1')
        .first<Record<string, unknown>>();

      expect(row?.outcome).toBe('convert');
      expect(row?.approved_by).toBe('حسین');
      expect(row?.delivered_to_user_at).not.toBeNull();
      // هنوز به هسته نرسیده — Cron می‌بردش.
      expect(row?.delivered_to_core_at).toBeNull();
    });
  });

  describe('پاسخ رد — اصل IV نباید سوراخ شود', () => {
    it('سه بخش یکی‌یکی پرسیده می‌شوند', async () => {
      await submitBug();
      adapter.clear();

      await send(PM, '__reply:REQ-1');
      await send(PM, '__outcome:reject');
      expect(adapter.lastText).toContain('۱ از ۳');

      await send(PM, 'فهمیدیم صفحه برای بخشی از کاربران باز نمی‌شود.');
      expect(adapter.lastText).toContain('۲ از ۳');

      await send(PM, 'چون بازنویسی همان بخش ماه دیگر شروع می‌شود.');
      expect(adapter.lastText).toContain('۳ از ۳');
    });

    it('پاسخ رد با هر سه بخش به ثبت‌کننده می‌رسد', async () => {
      await submitBug();
      adapter.clear();

      await send(PM, '__reply:REQ-1');
      await send(PM, '__outcome:reject');
      await send(PM, 'فهمیدیم صفحه باز نمی‌شود.');
      await send(PM, 'چون بازنویسی ماه دیگر است.');
      await send(PM, 'اگر بیش از صد نفر گزارش دهند، جلو می‌افتد.');

      const delivered = toSubmitter().at(-1)?.text ?? '';
      expect(delivered).toContain('فعلاً نه ❌');
      expect(delivered).toContain('چه فهمیدیم:');
      expect(delivered).toContain('چرا الان نه:');
      expect(delivered).toContain('در چه شرایطی بله:');
    });

    it('رد ناقص در پایگاه داده هم غیرممکن است — قید جدول', async () => {
      // ناوردای FR-031 دو لایه دارد: اعتبارسنجی کد، و این قید. اگر روزی
      // مسیری اعتبارسنجی را دور بزند، جدول همچنان جلویش را می‌گیرد.
      await expect(
        env.DB.prepare(
          `INSERT INTO triage_decision
             (response_id, request_id, chat_id, outcome, body, approved_by, decided_at)
           VALUES ('RSP-9999', 'REQ-1', '1', 'reject', 'متن', 'حسین', 1)`,
        ).run(),
      ).rejects.toThrow();
    });
  });

  describe('دسترسی', () => {
    it('ثبت‌کنندهٔ عادی میز تریاژ ندارد', async () => {
      await submitBug();
      adapter.clear();

      await send(SUBMITTER, '/inbox');

      // راهنمای عادی می‌گیرد — نه خطا، نه اشاره‌ای که چنین چیزی هست.
      expect(adapter.lastText).toContain('/start');
      expect(adapter.lastText).not.toContain('میز تریاژ');
    });

    it('ثبت‌کنندهٔ عادی نمی‌تواند به درخواستی پاسخ بدهد', async () => {
      await submitBug();
      adapter.clear();

      await send(SUBMITTER, '__reply:REQ-1');

      const decisions = await env.DB.prepare('SELECT COUNT(*) AS n FROM triage_decision').first<{
        n: number;
      }>();
      expect(decisions?.n).toBe(0);
    });

    it('راهنمای مدیر محصول میز را نشان می‌دهد', async () => {
      await send(PM, '/help');
      expect(adapter.lastText).toContain('/inbox');
    });
  });

  describe('صندوق ورودی', () => {
    it('درخواست‌های بدون پاسخ را می‌آورد', async () => {
      await submitBug();
      await submitIdea();
      adapter.clear();

      await send(PM, '/inbox');

      expect(adapter.allText).toContain('۲ درخواست بدون پاسخ');
      expect(adapter.allText).toContain('REQ-1');
      expect(adapter.allText).toContain('REQ-2');
    });

    it('پاسخ‌داده‌شده‌ها دیگر در صندوق نیستند', async () => {
      await submitBug();
      await send(PM, '__reply:REQ-1');
      await send(PM, '__outcome:convert');
      await send(PM, 'درست شد.');
      adapter.clear();

      await send(PM, '/inbox');
      expect(adapter.allText).toContain('چیزی بدون پاسخ نمانده');
    });

    it('فیلتر نوع کار می‌کند', async () => {
      await submitBug();
      await submitIdea();
      adapter.clear();

      await send(PM, '__inbox:idea');
      expect(adapter.allText).toContain('REQ-2');
      expect(adapter.allText).not.toContain('REQ-1 ');
    });
  });

  describe('محافظت‌ها', () => {
    it('پاسخ دوباره به یک درخواست پذیرفته نمی‌شود', async () => {
      await submitBug();
      await send(PM, '__reply:REQ-1');
      await send(PM, '__outcome:convert');
      await send(PM, 'درست شد.');
      adapter.clear();

      await send(PM, '__reply:REQ-1');
      expect(adapter.lastText).toContain('قبلاً پاسخ گرفته');
    });

    it('میز تریاژ ثبتِ خودِ مدیر محصول را خراب نمی‌کند', async () => {
      // مدیر محصول هم ثبت‌کننده است. اگر حالت مشترک بود، پاسخ دادن وسط ثبتِ
      // خودش آن ثبت را نابود می‌کرد.
      await submitBug();

      await send(PM, '/start');
      await send(PM, 'management');
      await send(PM, 'improvement');
      await send(PM, 'می‌خواهم گزارش بهتری ببینم');
      adapter.clear();

      // وسط ثبت خودش، به خرابی دیگری پاسخ می‌دهد.
      await send(PM, '__reply:REQ-1');
      await send(PM, '__outcome:convert');
      await send(PM, 'درست شد.');
      adapter.clear();

      // ثبت خودش باید دقیقاً همان‌جا مانده باشد.
      await send(PM, 'پنل مدیریت');
      expect(adapter.lastText).toContain('الان چطور کار می‌کند');
    });

    it('«بی‌خیال» پاسخ را لغو می‌کند و چیزی نمی‌فرستد', async () => {
      await submitBug();
      await send(PM, '__reply:REQ-1');
      await send(PM, '__desk_cancel');
      adapter.clear();

      const decisions = await env.DB.prepare('SELECT COUNT(*) AS n FROM triage_decision').first<{
        n: number;
      }>();
      expect(decisions?.n).toBe(0);
    });
  });
});

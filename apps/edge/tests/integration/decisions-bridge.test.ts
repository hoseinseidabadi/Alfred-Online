import { applyD1Migrations, env, runInDurableObject } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, inject, it, vi } from 'vitest';
import type { BridgeDecision, BridgeDecisionsRequest } from '@alfred-online/contracts';
import { runBridgeCycle } from '../../src/bridge/cron';
import type { CounterDO } from '../../src/counter/counter.do';
import { handleUpdate } from '../../src/webhook/router';
import type { TelegramUpdate } from '../../src/webhook/update';
import { FakeAdapter } from '../helpers/fake-adapter';

/**
 * زنجیرهٔ کامل: میز تلگرامی → صف D1 → هسته.
 *
 * چیزی که این آزمون‌ها نگه می‌دارند: **تصمیم‌ها گم نمی‌شوند.** پاسخ همان لحظه
 * به ثبت‌کننده می‌رسد (اصل III)، ولی منبع حقیقت هم باید بالاخره خبردار شود —
 * وگرنه تاریخچهٔ «قبلاً چه جوابی دادم» ناقص می‌ماند.
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

/** هستهٔ ساختگی که هر دو جهت پل را می‌فهمد. */
class FakeCore {
  readonly submissions: string[] = [];
  readonly decisions: BridgeDecision[] = [];
  down = false;

  install(): void {
    vi.spyOn(globalThis, 'fetch').mockImplementation((async (
      input: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      const url = String(input);

      // بررسی عضویت — همیشه عضو.
      if (url.includes('api.telegram.org')) {
        return Response.json({
          ok: true,
          result: { status: 'member', user: { id: 1, is_bot: false, first_name: 'x' } },
        });
      }

      if (this.down) throw new Error('ECONNREFUSED');

      if (url.endsWith('/bridge/submissions')) {
        const body = JSON.parse(String(init?.body ?? '{}')) as {
          submissions?: { requestId: string }[];
        };
        const ids = (body.submissions ?? []).map((s) => s.requestId);
        this.submissions.push(...ids);
        return Response.json({ accepted: ids, rejected: [] });
      }

      if (url.endsWith('/bridge/decisions')) {
        const body = JSON.parse(String(init?.body ?? '{}')) as BridgeDecisionsRequest;
        const incoming = body.decisions ?? [];
        const accepted: string[] = [];
        const rejected: { requestId: string; reason: string }[] = [];
        for (const d of incoming) {
          // همان قید هسته: تصمیم برای ثبتِ نرسیده رد می‌شود.
          if (!this.submissions.includes(d.requestId)) {
            rejected.push({ requestId: d.requestId, reason: 'درخواست هنوز در هسته نیست' });
            continue;
          }
          if (!this.decisions.some((x) => x.responseId === d.responseId)) this.decisions.push(d);
          accepted.push(d.responseId);
        }
        return Response.json({ accepted, rejected });
      }

      return Response.json({ received: true });
    }) as unknown as typeof fetch);
  }
}

describe('تصمیم‌های میز تریاژ به هسته می‌رسند', () => {
  let adapter: FakeAdapter;
  let core: FakeCore;

  beforeEach(async () => {
    await applyD1Migrations(env.DB, inject('d1Migrations'));
    for (const t of ['edge_submission', 'triage_decision']) {
      await env.DB.prepare(`DELETE FROM ${t}`).run();
    }
    await env.DB.prepare('UPDATE response_counter SET last_number = 0 WHERE id = 1').run();
    await runInDurableObject(
      env.COUNTER.get(env.COUNTER.idFromName('global')) as DurableObjectStub<CounterDO>,
      async (_i, s) => {
        await s.storage.deleteAll();
      },
    );
    for (const chat of [PM, SUBMITTER]) {
      await runInDurableObject(
        env.CONVERSATION.get(env.CONVERSATION.idFromName(String(chat))),
        async (_i, s) => {
          await s.storage.deleteAll();
        },
      );
    }
    adapter = new FakeAdapter();
    core = new FakeCore();
    core.install();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const send = (chatId: number, text: string) => handleUpdate(from(chatId, text), { env, adapter });

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

  const answerIt = async (requestId: string, text: string) => {
    await send(PM, `__reply:${requestId}`);
    await send(PM, '__outcome:convert');
    await send(PM, text);
  };

  it('یک چرخهٔ Cron هم ثبت و هم تصمیم را می‌برد', async () => {
    await submitBug();
    await answerIt('REQ-1', 'مربوط به کش است. درست شد.');

    const cycle = await runBridgeCycle(env);

    expect(cycle.submissionsDelivered).toBe(1);
    expect(cycle.decisionsDelivered).toBe(1);
    expect(core.decisions[0]?.requestId).toBe('REQ-1');
  });

  it('ترتیب مهم است — ثبت پیش از تصمیم در همان چرخه می‌رود', async () => {
    // اگر تصمیم اول می‌رفت، هسته ردش می‌کرد و یک دور عقب می‌افتاد.
    await submitBug();
    await answerIt('REQ-1', 'درست شد.');

    await runBridgeCycle(env);

    expect(core.decisions).toHaveLength(1);
    const row = await env.DB.prepare(
      'SELECT delivered_to_core_at FROM triage_decision WHERE response_id = ?',
    )
      .bind('RSP-0001')
      .first<{ delivered_to_core_at: number | null }>();
    expect(row?.delivered_to_core_at).not.toBeNull();
  });

  it('متن پاسخ عیناً به هسته می‌رسد', async () => {
    await submitBug();
    await answerIt('REQ-1', 'مربوط به کش صفحه است. امروز درست می‌شود.');
    await runBridgeCycle(env);

    expect(core.decisions[0]?.body).toContain('مربوط به کش صفحه است');
    expect(core.decisions[0]?.approvedBy).toBe('حسین');
    expect(core.decisions[0]?.deliveredToUserAt).not.toBeNull();
  });

  it('در قطعی، تصمیم گم نمی‌شود و دور بعد می‌رود', async () => {
    await submitBug();
    await answerIt('REQ-1', 'درست شد.');

    core.down = true;
    const failed = await runBridgeCycle(env);
    expect(failed.error).not.toBeNull();
    expect(core.decisions).toHaveLength(0);

    core.down = false;
    const recovered = await runBridgeCycle(env);
    expect(recovered.decisionsDelivered).toBe(1);
  });

  it('پاسخ به ثبت‌کننده حتی در قطعیِ هسته می‌رسد — اصل III', async () => {
    await submitBug();
    core.down = true;

    await answerIt('REQ-1', 'درست شد.');

    // ثبت‌کننده جوابش را گرفته، با اینکه هسته اصلاً در دسترس نیست.
    const toSubmitter = adapter.sent.filter((m) => m.recipient === String(SUBMITTER));
    expect(toSubmitter.at(-1)?.text).toContain('بررسی شد ✅');
  });

  it('اجرای دوبارهٔ Cron تصمیم تکراری نمی‌فرستد', async () => {
    await submitBug();
    await answerIt('REQ-1', 'درست شد.');

    await runBridgeCycle(env);
    const second = await runBridgeCycle(env);

    expect(second.decisionsDelivered).toBe(0);
    expect(core.decisions).toHaveLength(1);
  });

  it('پاسخ رد هر سه بخش را تا هسته می‌برد', async () => {
    await submitBug();
    await send(PM, '__reply:REQ-1');
    await send(PM, '__outcome:reject');
    await send(PM, 'فهمیدیم صفحه باز نمی‌شود.');
    await send(PM, 'چون بازنویسی ماه دیگر است.');
    await send(PM, 'اگر بیش از صد نفر گزارش دهند.');

    await runBridgeCycle(env);

    const sent = core.decisions[0];
    expect(sent?.outcome).toBe('reject');
    expect(sent?.rejectUnderstood).toBe('فهمیدیم صفحه باز نمی‌شود.');
    expect(sent?.rejectWhyNot).toBe('چون بازنویسی ماه دیگر است.');
    expect(sent?.rejectWhenYes).toBe('اگر بیش از صد نفر گزارش دهند.');
  });
});

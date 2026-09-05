import type { BridgeDecision, BridgeSubmission } from '@alfred-online/contracts';
import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AuditService } from '../../src/common/audit.service';
import { DeadlineService } from '../../src/modules/intake/deadline.service';
import { RequestService } from '../../src/modules/intake/request.service';
import { ResponseService } from '../../src/modules/intake/response.service';
import { SubmitterService } from '../../src/modules/intake/submitter.service';
import { applyMigrations, hasTestDatabase, resetDatabase, testClient } from '../helpers/database';

/**
 * آزمون قرارداد `POST /bridge/decisions` — جهت سوم پل.
 *
 * **این جایی است که «قبلاً چه جوابی داده‌ام» ثبت می‌شود.** پاسخی که از میز
 * تلگرامی می‌رود، در D1 لبه هم هست — ولی آن حافظهٔ کوتاه‌مدت است. تاریخچهٔ
 * کامل باید اینجا کنار خود درخواست بنشیند.
 */

const submission = (over: Partial<BridgeSubmission> = {}): BridgeSubmission => ({
  requestId: 'REQ-1',
  chatId: '555111222',
  submitterName: 'مریم',
  unit: 'editorial',
  requestType: 'bug',
  rawAnswers: { where: 'وب‌سایت', observed: 'خطای ۵۰۲ داد' },
  attachments: [],
  submittedAt: '2026-08-24T06:44:00Z',
  ...over,
});

const decision = (over: Partial<BridgeDecision> = {}): BridgeDecision => ({
  responseId: 'RSP-0001',
  requestId: 'REQ-1',
  outcome: 'convert',
  body: 'REQ-1 — بررسی شد ✅\n\nمربوط به کش صفحه است. امروز درست می‌شود.',
  approvedBy: 'حسین',
  decidedAt: '2026-08-24T09:00:00Z',
  deliveredToUserAt: '2026-08-24T09:00:02Z',
  ...over,
});

describe.skipIf(!hasTestDatabase)('قرارداد پل — POST /bridge/decisions', () => {
  let prisma: PrismaClient;
  let requests: RequestService;
  let responses: ResponseService;

  beforeAll(() => {
    applyMigrations();
    prisma = testClient();
    const p = prisma as unknown as ConstructorParameters<typeof RequestService>[0];
    requests = new RequestService(p, new SubmitterService(p), new DeadlineService());
    responses = new ResponseService(p, new AuditService(p));
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    await requests.accept(submission());
  });

  it('تصمیم را می‌پذیرد و پاسخ را کنار درخواست ثبت می‌کند', async () => {
    const outcome = await responses.record(decision());
    expect(outcome).toEqual({ status: 'accepted', responseId: 'RSP-0001' });

    const stored = await prisma.response.findUniqueOrThrow({ where: { id: 'RSP-0001' } });
    expect(stored.requestId).toBe('REQ-1');
    expect(stored.kind).toBe('convert');
    expect(stored.approvedBy).toBe('حسین');
  });

  it('متن پاسخ عیناً همان چیزی است که ثبت‌کننده دید', async () => {
    const input = decision();
    await responses.record(input);
    const stored = await prisma.response.findUniqueOrThrow({ where: { id: 'RSP-0001' } });
    // هسته بازنویسی نمی‌کند — همان قاعده‌ای که برای `rawAnswers` داریم.
    expect(stored.body).toBe(input.body);
  });

  it('درخواست به answered می‌رود، نه closed — SC-009', async () => {
    await responses.record(decision());
    const request = await prisma.request.findUniqueOrThrow({ where: { id: 'REQ-1' } });

    expect(request.status).toBe('answered');
    expect(request.closedAt).toBeNull();
    // `serviceRef` هنوز خالی است، پس بستن مجاز نیست.
    expect(request.serviceRef).toBeNull();
  });

  it('respondedAt پر می‌شود — تعهد پاسخ انجام شده', async () => {
    await responses.record(decision());
    const request = await prisma.request.findUniqueOrThrow({ where: { id: 'REQ-1' } });
    expect(request.respondedAt?.toISOString()).toBe('2026-08-24T09:00:00.000Z');
    expect(request.triageOutcome).toBe('convert');
  });

  it('تحویل به کاربر پیش از رسیدن به هسته ثبت می‌شود', async () => {
    await responses.record(decision());
    const stored = await prisma.response.findUniqueOrThrow({ where: { id: 'RSP-0001' } });
    // برخلاف مسیر عادی، `deliveredAt` از قبل پر است.
    expect(stored.deliveredAt?.toISOString()).toBe('2026-08-24T09:00:02.000Z');
  });

  it('idempotent است — ارسال دوباره رکورد تکراری نمی‌سازد', async () => {
    await responses.record(decision());
    const second = await responses.record(decision());

    expect(second.status).toBe('duplicate');
    expect(await prisma.response.count()).toBe(1);
  });

  it('پاسخ رد هر سه بخش را نگه می‌دارد — FR-031', async () => {
    await responses.record(
      decision({
        outcome: 'reject',
        rejectUnderstood: 'فهمیدیم صفحه باز نمی‌شود.',
        rejectWhyNot: 'چون بازنویسی ماه دیگر است.',
        rejectWhenYes: 'اگر بیش از صد نفر گزارش دهند.',
      }),
    );

    const stored = await prisma.response.findUniqueOrThrow({ where: { id: 'RSP-0001' } });
    expect(stored.rejectUnderstood).toBe('فهمیدیم صفحه باز نمی‌شود.');
    expect(stored.rejectWhyNot).toBe('چون بازنویسی ماه دیگر است.');
    expect(stored.rejectWhenYes).toBe('اگر بیش از صد نفر گزارش دهند.');
  });

  it('تصمیم برای درخواستِ نرسیده رد می‌شود، نه اینکه رکورد یتیم بسازد', async () => {
    const outcome = await responses.record(decision({ requestId: 'REQ-404' }));
    expect(outcome.status).toBe('rejected');
    expect(await prisma.response.count()).toBe(0);
  });

  it('تغییر وضعیت در سابقه ثبت می‌شود', async () => {
    await responses.record(decision());

    const entries = await prisma.auditEntry.findMany({ where: { entityId: 'REQ-1' } });
    const fields = entries.map((e) => e.field).sort();
    expect(fields).toEqual(['status', 'triageOutcome']);
    expect(entries.every((e) => e.actor === 'حسین')).toBe(true);
  });

  it('تاریخچهٔ پاسخ‌ها قابل بازیابی است — «قبلاً چه جوابی دادم؟»', async () => {
    await responses.record(decision());
    await responses.record(
      decision({
        responseId: 'RSP-0002',
        outcome: 'need_data',
        body: 'یک سوال دیگر هم دارم.',
        decidedAt: '2026-08-25T10:00:00Z',
      }),
    );

    const history = await responses.historyFor('REQ-1');
    expect(history).toHaveLength(2);
    // تازه‌ترین اول.
    expect(history[0]?.id).toBe('RSP-0002');
    expect(history[1]?.id).toBe('RSP-0001');
  });

  it('پاسخ دوم زمانِ اولین پاسخ را عوض نمی‌کند', async () => {
    // تعهد پاسخ با **اولین** جواب انجام می‌شود، نه آخرین.
    await responses.record(decision());
    await responses.record(decision({ responseId: 'RSP-0002', decidedAt: '2026-09-10T10:00:00Z' }));

    const request = await prisma.request.findUniqueOrThrow({ where: { id: 'REQ-1' } });
    expect(request.respondedAt?.toISOString()).toBe('2026-08-24T09:00:00.000Z');
  });

  it('رد شدن یک قلم بقیه را زمین نمی‌زند', async () => {
    await requests.accept(submission({ requestId: 'REQ-2', chatId: '999' }));

    const outcomes = [
      await responses.record(decision()),
      await responses.record(decision({ responseId: 'RSP-0002', requestId: 'REQ-404' })),
      await responses.record(decision({ responseId: 'RSP-0003', requestId: 'REQ-2' })),
    ];

    expect(outcomes.map((o) => o.status)).toEqual(['accepted', 'rejected', 'accepted']);
    expect(await prisma.response.count()).toBe(2);
  });
});

import type { BridgeSubmission } from '@alfred-online/contracts';
import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DeadlineService } from '../../src/modules/intake/deadline.service';
import { RequestService } from '../../src/modules/intake/request.service';
import { SubmitterService } from '../../src/modules/intake/submitter.service';
import { applyMigrations, hasTestDatabase, resetDatabase, testClient } from '../helpers/database';

/**
 * آزمون قرارداد `POST /bridge/submissions` — T030.
 *
 * روی همان موتور تولید اجرا می‌شود چون چیزی که می‌سنجد — idempotency روی کلید
 * اصلی، حفظ ترتیب، دست‌نخوردگی JSON فارسی — در هیچ جایگزین درون‌حافظه‌ای وجود
 * ندارد.
 */

const submission = (over: Partial<BridgeSubmission> = {}): BridgeSubmission => ({
  requestId: 'REQ-149',
  chatId: '265966801',
  submitterName: 'حسین',
  unit: 'editorial',
  requestType: 'bug',
  rawAnswers: {
    where: 'وب‌سایت',
    action: 'صفحهٔ خبر رو باز کردم، ساعت شلوغی عصر',
    observed: 'خطای 502 داد',
    since: 'this_week',
    scope: 'few_people',
    roleQuestion: 'خواننده صفحه را نمی‌بیند',
  },
  attachments: [],
  submittedAt: '2026-08-24T06:44:00Z',
  ...over,
});

describe.skipIf(!hasTestDatabase)('قرارداد پل — POST /bridge/submissions', () => {
  let prisma: PrismaClient;
  let requests: RequestService;

  beforeAll(() => {
    applyMigrations();
    prisma = testClient();
    const service = prisma as unknown as ConstructorParameters<typeof RequestService>[0];
    requests = new RequestService(service, new SubmitterService(service), new DeadlineService());
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  it('ثبت را می‌پذیرد و شناسهٔ صادرشده در لبه را نگه می‌دارد', async () => {
    const outcome = await requests.accept(submission());
    expect(outcome).toEqual({ status: 'accepted', requestId: 'REQ-149' });

    const stored = await prisma.request.findUniqueOrThrow({ where: { id: 'REQ-149' } });
    // شماره در لبه صادر شده و هسته آن را عوض نمی‌کند — FR-020.
    expect(stored.id).toBe('REQ-149');
  });

  it('idempotent است — ارسال دوباره رکورد تکراری نمی‌سازد', async () => {
    await requests.accept(submission());
    const second = await requests.accept(submission());

    expect(second.status).toBe('duplicate');
    expect(await prisma.request.count()).toBe(1);
  });

  it('پاسخ خام فارسی را دست نمی‌زند — اصل II', async () => {
    const input = submission();
    await requests.accept(input);

    const stored = await prisma.request.findUniqueOrThrow({ where: { id: input.requestId } });
    // نه trim، نه نرمال‌سازی، نه مرتب‌سازی کلید. عیناً همان.
    expect(stored.rawAnswers).toEqual(input.rawAnswers);
  });

  it('مهلت را خودش حساب می‌کند، نه لبه — و به تفکیک نوع', async () => {
    // نمونهٔ پیش‌فرض `bug` است: تعهد سه روزه.
    await requests.accept(submission());
    const bug = await prisma.request.findUniqueOrThrow({ where: { id: 'REQ-149' } });
    expect(bug.submittedAt.toISOString()).toBe('2026-08-24T06:44:00.000Z');
    expect(bug.responseDueAt.toISOString()).toBe('2026-08-27T06:44:00.000Z');

    // همان لحظهٔ ثبت، نوع دیگر: تعهد هفت روزه.
    await requests.accept(submission({ requestId: 'REQ-150', requestType: 'idea' }));
    const idea = await prisma.request.findUniqueOrThrow({ where: { id: 'REQ-150' } });
    expect(idea.responseDueAt.toISOString()).toBe('2026-08-31T06:44:00.000Z');
  });

  it('حدس اولیهٔ ثبت‌کننده جدا نگه داشته می‌شود', async () => {
    await requests.accept(submission({ requestType: 'bug' }));
    const stored = await prisma.request.findUniqueOrThrow({ where: { id: 'REQ-149' } });
    expect(stored.type).toBe('bug');
    expect(stored.originalType).toBe('bug');
  });

  it('ترتیب زمانی حفظ می‌شود — FR-017', async () => {
    const batch = [
      submission({ requestId: 'REQ-1', submittedAt: '2026-08-24T06:00:00Z' }),
      submission({ requestId: 'REQ-2', submittedAt: '2026-08-24T07:00:00Z' }),
      submission({ requestId: 'REQ-3', submittedAt: '2026-08-24T08:00:00Z' }),
    ];
    for (const item of batch) await requests.accept(item);

    const stored = await prisma.request.findMany({ orderBy: { submittedAt: 'asc' } });
    expect(stored.map((r) => r.id)).toEqual(['REQ-1', 'REQ-2', 'REQ-3']);
  });

  it('رد شدن یک قلم بقیه را زمین نمی‌زند', async () => {
    const batch = [
      submission({ requestId: 'REQ-10' }),
      submission({ requestId: 'REQ-11', submittedAt: 'تاریخ خراب' }),
      submission({ requestId: 'REQ-12' }),
    ];
    const outcomes = [];
    for (const item of batch) outcomes.push(await requests.accept(item));

    expect(outcomes.map((o) => o.status)).toEqual(['accepted', 'rejected', 'accepted']);
    // دو قلم سالم رسیده‌اند، با اینکه وسطشان یکی خراب بود.
    expect(await prisma.request.count()).toBe(2);
  });

  it('ثبت‌کننده یک بار ساخته می‌شود و شمارشش جلو می‌رود', async () => {
    await requests.accept(submission({ requestId: 'REQ-20' }));
    await requests.accept(submission({ requestId: 'REQ-21' }));

    const submitters = await prisma.submitter.findMany();
    expect(submitters).toHaveLength(1);
    expect(submitters[0]?.requestCount).toBe(2);
  });

  it('واحد سازمانی قابل اصلاح است ولی دوباره پرسیده نمی‌شود — FR-003', async () => {
    await requests.accept(submission({ requestId: 'REQ-30', unit: 'editorial' }));
    await requests.accept(submission({ requestId: 'REQ-31', unit: 'technical' }));

    const submitter = await prisma.submitter.findUniqueOrThrow({
      where: { chatId: '265966801' },
    });
    expect(submitter.unit).toBe('technical');
  });

  it('وضعیت اولیه new است و هیچ پاسخی ندارد', async () => {
    await requests.accept(submission());
    const stored = await prisma.request.findUniqueOrThrow({ where: { id: 'REQ-149' } });
    expect(stored.status).toBe('new');
    expect(stored.respondedAt).toBeNull();
    expect(stored.source).toBe('bot');
  });
});

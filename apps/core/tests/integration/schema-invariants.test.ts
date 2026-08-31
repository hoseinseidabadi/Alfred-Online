import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  NO_DATABASE_REASON,
  applyMigrations,
  hasTestDatabase,
  resetDatabase,
  testClient,
} from '../helpers/database';

/**
 * ناورداهایی که **پایگاه داده** نگهشان می‌دارد، نه کد.
 *
 * اینها روی PostgreSQL واقعی سنجیده می‌شوند چون قید کلید خارجی و ایندکس یکتا
 * در هیچ جایگزین درون‌حافظه‌ای وجود ندارند — آزمونشان آنجا فقط توهم پوشش است.
 */
describe.skipIf(!hasTestDatabase)('ناورداهای شما — T016، T017', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    applyMigrations();
    prisma = testClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  const seedRequest = async (id = 'REQ-001') => {
    const submitter = await prisma.submitter.create({
      data: { chatId: `chat-${id}`, displayName: 'حسین', unit: 'editorial' },
    });
    return prisma.request.create({
      data: {
        id,
        type: 'bug',
        originalType: 'bug',
        submitterId: submitter.id,
        unit: 'editorial',
        rawAnswers: { where: 'وب‌سایت', observed: 'خطای ۵۰۲ داد' },
        submittedAt: new Date('2026-08-24T06:44:00Z'),
        responseDueAt: new Date('2026-08-31T06:44:00Z'),
      },
    });
  };

  it('ناوردای ۹ — درخواستی که پاسخ دارد قابل حذف نیست', async () => {
    const request = await seedRequest();
    await prisma.response.create({
      data: {
        id: 'RSP-0001',
        requestId: request.id,
        kind: 'convert',
        body: 'بررسی شد ✅',
        approvedBy: 'product',
        approvedAt: new Date(),
      },
    });

    // RESTRICT یعنی حذف **ناممکن** است، نه اینکه آبشاری شود.
    await expect(prisma.request.delete({ where: { id: request.id } })).rejects.toThrow();
    expect(await prisma.request.count()).toBe(1);
  });

  it('ناوردای ۹ — ثبت‌کننده‌ای که درخواست دارد قابل حذف نیست', async () => {
    const request = await seedRequest();
    await expect(prisma.submitter.delete({ where: { id: request.submitterId } })).rejects.toThrow();
  });

  it('پاسخ خام فارسی عیناً برمی‌گردد — اصل II', async () => {
    const raw = {
      where: 'وب‌سایت',
      action: 'صفحهٔ خبر رو باز کردم، ساعت شلوغی عصر',
      observed: 'خطای 502 داد',
    };
    const submitter = await prisma.submitter.create({
      data: { chatId: 'chat-raw', displayName: 'حسین', unit: 'editorial' },
    });
    await prisma.request.create({
      data: {
        id: 'REQ-RAW',
        type: 'bug',
        originalType: 'bug',
        submitterId: submitter.id,
        unit: 'editorial',
        rawAnswers: raw,
        submittedAt: new Date(),
        responseDueAt: new Date(),
      },
    });

    const stored = await prisma.request.findUniqueOrThrow({ where: { id: 'REQ-RAW' } });
    // بدون نرمال‌سازی، بدون تغییر ترتیب کلیدها، بدون دست‌کاری متن فارسی.
    expect(stored.rawAnswers).toEqual(raw);
  });

  it('شناسهٔ درخواست با تغییر نوع عوض نمی‌شود — ناوردای ۳، FR-021', async () => {
    const request = await seedRequest('REQ-TYPE');
    const updated = await prisma.request.update({
      where: { id: request.id },
      data: { type: 'improvement' },
    });
    expect(updated.id).toBe('REQ-TYPE');
    // حدس اولیهٔ ثبت‌کننده دست‌نخورده می‌ماند.
    expect(updated.originalType).toBe('bug');
  });

  it('صف تک‌خطی است — دو آیتم نمی‌توانند یک موقعیت بگیرند', async () => {
    const first = await seedRequest('REQ-Q1');
    const second = await seedRequest('REQ-Q2');
    await prisma.queueItem.create({ data: { requestId: first.id, position: 1 } });
    await expect(
      prisma.queueItem.create({ data: { requestId: second.id, position: 1 } }),
    ).rejects.toThrow();
  });

  it('هر بُعد فقط یک مقدار استخراجی به‌ازای هر درخواست دارد — ناوردای ۲', async () => {
    const request = await seedRequest('REQ-DV');
    await prisma.derivedValue.create({
      data: { requestId: request.id, dimension: 'severity', value: 'critical', ruleVersion: 3 },
    });
    await expect(
      prisma.derivedValue.create({
        data: { requestId: request.id, dimension: 'severity', value: 'low', ruleVersion: 3 },
      }),
    ).rejects.toThrow();
  });

  it('زمان‌ها UTC ذخیره می‌شوند — ناوردای ۱۰', async () => {
    const submittedAt = new Date('2026-08-24T06:44:00Z');
    const submitter = await prisma.submitter.create({
      data: { chatId: 'chat-utc', displayName: 'حسین', unit: 'technical' },
    });
    await prisma.request.create({
      data: {
        id: 'REQ-UTC',
        type: 'idea',
        originalType: 'idea',
        submitterId: submitter.id,
        unit: 'technical',
        rawAnswers: {},
        submittedAt,
        responseDueAt: new Date('2026-08-31T06:44:00Z'),
      },
    });
    const stored = await prisma.request.findUniqueOrThrow({ where: { id: 'REQ-UTC' } });
    expect(stored.submittedAt.toISOString()).toBe('2026-08-24T06:44:00.000Z');
  });
});

describe('پیش‌نیاز آزمون‌های یکپارچه', () => {
  /**
   * بدون این، نبودِ `TEST_DATABASE_URL` در CI به «همه سبز» ختم می‌شد در حالی
   * که هفت آزمون بالا اصلاً اجرا نشده بودند — همان سبزیِ دروغینی که نگهبان
   * آزمون‌های تاب‌آوری هم برای جلوگیری از آن ساخته شد.
   *
   * روی ماشین دولوپر فقط هشدار می‌دهد؛ در CI شکست می‌دهد.
   */
  it('در CI پایگاه دادهٔ آزمون MUST در دسترس باشد', () => {
    if (process.env.CI === 'true') {
      expect(hasTestDatabase, NO_DATABASE_REASON).toBe(true);
      return;
    }
    if (!hasTestDatabase) console.warn(`⏭  آزمون‌های یکپارچه رد شدند: ${NO_DATABASE_REASON}`);
    expect(typeof hasTestDatabase).toBe('boolean');
  });
});

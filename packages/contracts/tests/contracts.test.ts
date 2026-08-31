import { describe, expect, it } from 'vitest';
import {
  BRIDGE_KEY_HEADER,
  CONTRACT_ERROR_STATUS,
  ContractErrorCode,
  FAST_TRACK_COMPLETION_WINDOW_HOURS,
  type BridgeAckRequest,
  type BridgeOutboundListResponse,
  type BridgeSubmissionsRequest,
  type BridgeSubmissionsResponse,
  type CreateDecisionRequest,
  type ReportPeriodResponse,
  type TriageBatchResponse,
  type TriageDecideRequest,
} from '../src/index';

/**
 * این فایل بیشتر یک **آزمون کامپایل** است تا آزمون زمان اجرا.
 *
 * هر ثابتِ زیر رونوشت عینِ نمونهٔ همان بند در `contracts/*.md` است. اگر کسی
 * تایپی را عوض کند و سند را نه، اینجا کامپایل نمی‌شود — همان واگرایی قراردادی
 * که `packages/contracts` برای جلوگیری از آن ساخته شد.
 */

describe('bridge-api — بند ۱: POST /bridge/submissions', () => {
  const request: BridgeSubmissionsRequest = {
    submissions: [
      {
        requestId: 'REQ-149',
        chatId: '…',
        submitterName: '…',
        unit: 'editorial',
        requestType: 'bug',
        rawAnswers: {
          where: 'وب‌سایت',
          action: 'صفحهٔ خبر رو باز کردم، ساعت شلوغی عصر',
          observed: 'خطای 502 داد',
          since: 'this_week',
          scope: 'few_people',
          roleQuestion: '…',
        },
        attachments: [{ kind: 'photo', ref: '…' }],
        submittedAt: '2026-08-24T06:44:00Z',
      },
    ],
  };

  const response: BridgeSubmissionsResponse = { accepted: ['REQ-149'], rejected: [] };

  it('نمونهٔ سند با تایپ می‌خواند', () => {
    expect(request.submissions[0]?.requestId).toBe('REQ-149');
    expect(response.accepted).toEqual(['REQ-149']);
  });

  it('rawAnswers فقط‌خواندنی است — اصل II در سطح تایپ', () => {
    const raw = request.submissions[0]?.rawAnswers;
    // @ts-expect-error پاسخ خام پس از درج تغییرناپذیر است (ناوردای ۱)
    raw.where = 'چیز دیگری';
    expect(raw?.where).toBeDefined();
  });
});

describe('bridge-api — بندهای ۲ و ۳: خروجی و تأیید تحویل', () => {
  const outbound: BridgeOutboundListResponse = {
    responses: [
      {
        responseId: 'RSP-0312',
        requestId: 'REQ-149',
        chatId: '…',
        body: 'REQ-149 — بررسی شد ✅\n\nاین باگ را در خرداد …',
        approvedAt: '2026-08-25T07:10:00Z',
      },
    ],
  };

  const ack: BridgeAckRequest = {
    delivered: [{ responseId: 'RSP-0312', sentAt: '2026-08-25T07:11:04Z' }],
  };

  it('شناسهٔ پاسخ در هر دو سو یکی است — پایهٔ idempotency', () => {
    expect(ack.delivered[0]?.responseId).toBe(outbound.responses[0]?.responseId);
  });

  it('نام هدر راز مشترک با حروف کوچک است', () => {
    expect(BRIDGE_KEY_HEADER).toBe('x-bridge-key');
  });
});

describe('triage-api — بند ۱: بستهٔ تریاژ', () => {
  const batch: TriageBatchResponse = {
    generatedAt: '2026-08-25T06:30:00Z',
    requests: [
      {
        id: 'REQ-149',
        type: 'bug',
        originalType: 'bug',
        unit: 'editorial',
        submitterName: '…',
        submittedAt: '2026-08-24T06:44:00Z',
        responseDueAt: '2026-08-31T06:44:00Z',
        daysRemaining: 6,
        atRisk: false,
        rawAnswers: { '…': 'عین متن فارسی، دست‌نخورده' },
        attachments: [],
        serviceRef: null,
        suggestedServiceRef: 'S-21',
        similarRequests: [{ id: 'REQ-118', title: '…', similarity: 'keyword' }],
      },
    ],
    queueSnapshot: {
      items: [{ requestId: 'REQ-118', position: 1, estimateDays: 10, status: 'in_progress' }],
      freeCapacityDays: 7,
    },
    extractionRules: { confidence: { version: 3 } },
  };

  it('مهلت هفت‌روزه از زمان ثبت مشتق شده', () => {
    const item = batch.requests[0];
    expect(item?.responseDueAt).toBe('2026-08-31T06:44:00Z');
    expect(item?.daysRemaining).toBe(6);
    expect(item?.atRisk).toBe(false);
  });

  it('صف تا فاز ۶ می‌تواند تهی باشد ولی کلید همیشه هست', () => {
    const empty: TriageBatchResponse['queueSnapshot'] = { items: [], freeCapacityDays: null };
    expect(empty.items).toEqual([]);
  });
});

describe('triage-api — بند ۲: ثبت نتیجهٔ تریاژ', () => {
  const decide: TriageDecideRequest = {
    type: 'bug',
    serviceRef: 'S-21',
    isCritical: true,
    outcome: 'convert',
    derived: [{ dimension: 'severity', value: 'critical', ruleVersion: 3, overridden: true }],
    response: { kind: 'convert', body: 'REQ-149 — بررسی شد ✅ …', approvedBy: 'product' },
    queue: { insertAtPosition: 1, estimateDays: 8 },
  };

  it('نمونهٔ سند با تایپ می‌خواند', () => {
    expect(decide.response.approvedBy).toBe('product');
  });

  it('approvedBy اختیاری نیست — اصل IV در سطح تایپ', () => {
    // @ts-expect-error هیچ پاسخی بدون تأیید انسان ارسال نمی‌شود (FR-033)
    const noApproval: TriageDecideRequest['response'] = { kind: 'reject', body: '…' };
    expect(noApproval).toBeDefined();
  });
});

describe('triage-api — بند ۳: تصمیم و استثنای مسیر سریع', () => {
  it('مسیر سریع بدون متریک و تاریخ بازبینی هم معتبر است', () => {
    const fastTrack: CreateDecisionRequest = {
      requestId: 'REQ-153',
      forum: 'fast_track',
      outcome: 'execute',
    };
    expect(fastTrack.successMetric).toBeUndefined();
    expect(FAST_TRACK_COMPLETION_WINDOW_HOURS).toBe(48);
  });

  it('نمونهٔ جلسهٔ شورا با هر سه فیلد', () => {
    const council: CreateDecisionRequest = {
      requestId: 'REQ-153',
      forum: 'council',
      outcome: 'execute',
      successMetric: 'نرخ گوش‌دادن خلاصهٔ صوتی در دو هفته از ۵٪ بازدیدکنندگان بگذرد',
      reviewDate: '2026-09-24',
      displaced: ['REQ-131'],
      sessionId: 'CS-004',
    };
    expect(council.sessionId).toBe('CS-004');
  });
});

describe('triage-api — بند ۵: گزارش دوره', () => {
  const report: ReportPeriodResponse = {
    from: '2026-06-22',
    to: '2026-09-22',
    funnel: { submitted: 34, evaluated: 9, executed: 3 },
    avgResponseDays: 5.2,
    slaBreaches: 0,
    unitDiversity: 4,
    fastTrackShare: 0.33,
    successRateByForum: { council: 0.75, fast_track: 0.4 },
  };

  it('نرخ موفقیت به تفکیک مرجع می‌آید — FR-044', () => {
    expect(Object.keys(report.successRateByForum).sort()).toEqual(['council', 'fast_track']);
  });
});

describe('کدهای خطا', () => {
  it('هر هشت کد نگاشت وضعیت دارند', () => {
    const codes = Object.values(ContractErrorCode);
    expect(codes).toHaveLength(8);
    for (const code of codes) {
      expect(CONTRACT_ERROR_STATUS[code]).toBeDefined();
    }
  });

  it('IMMUTABLE تنها ۴۰۳ است، بقیه ۴۲۲', () => {
    const forbidden = Object.entries(CONTRACT_ERROR_STATUS)
      .filter(([, status]) => status === 403)
      .map(([code]) => code);
    expect(forbidden).toEqual(['IMMUTABLE']);
  });

  it('هر کد با اسم خودش برابر است تا سریال‌سازی امن بماند', () => {
    for (const [key, value] of Object.entries(ContractErrorCode)) {
      expect(value).toBe(key);
    }
  });
});

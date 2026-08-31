import { vi } from 'vitest';
import type { BridgeSubmission, BridgeSubmissionsRequest } from '@alfred-online/contracts';

/**
 * هستهٔ ساختگی برای آزمون‌های پل.
 *
 * عمداً **رفتار قرارداد را واقعاً پیاده می‌کند**، نه اینکه جواب ثابت بدهد:
 * idempotency روی `requestId` و حفظ ترتیب. اگر یک stub ساده بود، آزمون‌های
 * الزامی ۳ و SC-004 می‌توانستند سبز باشند در حالی که کد لبه ترتیب یا
 * یکتایی را می‌شکند.
 */
export class FakeCore {
  /** ثبت‌های رسیده، به‌ترتیب ورود. تکراری‌ها اینجا نمی‌آیند. */
  readonly received: BridgeSubmission[] = [];
  /** هر بدنه‌ای که رسید، حتی تکراری — برای سنجش تلاش‌های دوباره. */
  readonly calls: BridgeSubmission[][] = [];

  private down = false;
  private readonly ids = new Set<string>();

  /** هسته را خاموش می‌کند — تماس‌ها اصلاً وصل نمی‌شوند. */
  stop(): void {
    this.down = true;
  }

  start(): void {
    this.down = false;
  }

  get isDown(): boolean {
    return this.down;
  }

  /** جایگزین `fetch` سراسری. */
  install(): void {
    vi.spyOn(globalThis, 'fetch').mockImplementation((async (
      input: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      const url = typeof input === 'string' ? input : input.toString();

      if (this.down) throw new Error('connect ECONNREFUSED — هسته خاموش است');

      if (url.endsWith('/bridge/health/stats')) {
        return Response.json({ received: true });
      }

      if (url.endsWith('/bridge/submissions')) {
        const body = JSON.parse(String(init?.body ?? '{}')) as BridgeSubmissionsRequest;
        const submissions = body.submissions ?? [];
        this.calls.push(submissions);

        const accepted: string[] = [];
        for (const submission of submissions) {
          // idempotency واقعی — همان چیزی که قرارداد الزام کرده.
          if (!this.ids.has(submission.requestId)) {
            this.ids.add(submission.requestId);
            this.received.push(submission);
          }
          accepted.push(submission.requestId);
        }
        return Response.json({ accepted, rejected: [] });
      }

      return Response.json({ ok: true, coreTime: new Date().toISOString() });
    }) as unknown as typeof fetch);
  }

  /** شناسه‌های رسیده، به‌ترتیب ورود. */
  get receivedIds(): string[] {
    return this.received.map((submission) => submission.requestId);
  }
}

import { DurableObject } from 'cloudflare:workers';

/**
 * شمارندهٔ سراسری صدور `REQ-NNN` (R-03، FR-016).
 * اسکلت فاز ۱ — پیاده‌سازی در T031، آزمون یکتایی در T032.
 */
export class CounterDO extends DurableObject {
  override async fetch(): Promise<Response> {
    return new Response('CounterDO — پیاده‌سازی در T031', { status: 501 });
  }
}

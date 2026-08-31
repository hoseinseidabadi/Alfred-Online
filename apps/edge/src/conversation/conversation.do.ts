import { DurableObject } from 'cloudflare:workers';

/**
 * حالت گفت‌وگوی هر کاربر (R-02، FR-013، FR-014).
 * اسکلت فاز ۱ — پیاده‌سازی در T036، آزمون بقا در T037.
 */
export class ConversationDO extends DurableObject {
  override async fetch(): Promise<Response> {
    return new Response('ConversationDO — پیاده‌سازی در T036', { status: 501 });
  }
}

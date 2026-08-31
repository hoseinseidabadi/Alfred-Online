import { Injectable } from '@nestjs/common';
import type { BridgePendingStats } from '@alfred-online/contracts';

/**
 * آخرین آمار سلامت پل که لبه گزارش کرده — FR-019.
 *
 * در حافظه نگه داشته می‌شود، نه در پایگاه داده. عمدی است: این داده **حال**
 * است نه **تاریخ**، و لبه هر چند دقیقه تازه‌اش می‌کند. ذخیره‌اش در جدول یعنی
 * نوشتنِ مکرر برای چیزی که هیچ‌کس گذشته‌اش را نمی‌خواهد.
 *
 * پیامدش: پس از راه‌اندازی دوبارهٔ هسته، تا اولین چرخهٔ Cron آماری نداریم —
 * و داشبورد باید همان «هنوز خبری نرسیده» را نشان دهد، نه صفر.
 */
@Injectable()
export class BridgeHealthService {
  private latest: (BridgePendingStats & { reportedAt: string }) | null = null;

  record(stats: BridgePendingStats): void {
    this.latest = { ...stats, reportedAt: new Date().toISOString() };
  }

  /** `null` یعنی هنوز گزارشی نرسیده — با «صفر معطلی» یکی نیست. */
  current(): (BridgePendingStats & { reportedAt: string }) | null {
    return this.latest;
  }
}

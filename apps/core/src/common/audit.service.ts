import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * نویسندهٔ سابقه — T018.
 *
 * قاعدهٔ data-model: **هر تغییر `type`، `isCritical`، `position` و `status`
 * MUST ثبت شود.** این چهار فیلد تصادفی انتخاب نشده‌اند؛ هرکدام چیزی‌اند که
 * بعداً کسی می‌پرسد «کی و چرا عوض شد؟»:
 *
 *   - `type`       تغییر نوع در تریاژ، بدون تغییر شناسه (FR-021)
 *   - `isCritical` تعیین بحرانی بودن، که فقط دست تریاژ است
 *   - `position`   جابه‌جایی در صف، که یعنی چیزی عقب افتاد (FR-037)
 *   - `status`     حرکت در چرخهٔ عمر، از جمله بسته شدن
 *
 * سابقه **فقط افزوده می‌شود** — هیچ به‌روزرسانی و هیچ حذفی (ناوردای ۹).
 */

/** فیلدهایی که تغییرشان MUST ثبت شود. */
export const AUDITED_FIELDS = ['type', 'isCritical', 'position', 'status'] as const;

export type AuditedField = (typeof AUDITED_FIELDS)[number];

export interface AuditChange {
  entity: string;
  entityId: string;
  field: string;
  oldValue: unknown;
  newValue: unknown;
  /** چه کسی تغییر داد — نام کاربر یا `system` برای تغییر خودکار. */
  actor: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * یک تغییر را ثبت می‌کند.
   *
   * تغییری که مقدار قبل و بعدش یکی است **ثبت نمی‌شود** — سابقه‌ای که پر از
   * ردیف‌های بی‌تغییر باشد، خواندنش سخت‌تر از نداشتنش است.
   */
  async record(change: AuditChange): Promise<void> {
    const oldValue = serialize(change.oldValue);
    const newValue = serialize(change.newValue);
    if (oldValue === newValue) return;

    await this.prisma.auditEntry.create({
      data: {
        entity: change.entity,
        entityId: change.entityId,
        field: change.field,
        oldValue,
        newValue,
        actor: change.actor,
      },
    });
  }

  /**
   * چند تغییر روی یک موجودیت را با هم ثبت می‌کند.
   * تغییرهای بی‌اثر همین‌جا کنار گذاشته می‌شوند.
   */
  async recordMany(changes: AuditChange[]): Promise<void> {
    const rows = changes
      .map((change) => ({
        entity: change.entity,
        entityId: change.entityId,
        field: change.field,
        oldValue: serialize(change.oldValue),
        newValue: serialize(change.newValue),
        actor: change.actor,
      }))
      .filter((row) => row.oldValue !== row.newValue);

    if (rows.length === 0) return;
    await this.prisma.auditEntry.createMany({ data: rows });
  }

  /** سابقهٔ یک موجودیت، تازه‌ترین اول. */
  async history(entity: string, entityId: string) {
    return this.prisma.auditEntry.findMany({
      where: { entity, entityId },
      orderBy: { at: 'desc' },
    });
  }
}

/**
 * مقدار را به رشتهٔ قابل ذخیره تبدیل می‌کند.
 *
 * `null` و `undefined` هر دو به `null` می‌روند: در سابقه، «مقدار نداشت» و
 * «فیلد اصلاً نبود» تفاوت معناداری ندارند و جدا نگه داشتنشان فقط خواندن را
 * سخت می‌کند.
 */
function serialize(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  return JSON.stringify(value);
}

/**
 * نقش‌های نشست — R-08، T019.
 *
 * دو نقش، عمداً نه بیشتر (اصل VII: تعداد کاربران این پنل یک‌رقمی است):
 *
 *   `product` مدیر محصول — خواندن و نوشتن
 *   `viewer`  مدیران — **فقط خواندن**
 *
 * فرض spec: «مدیران به داشبورد فقط دسترسی خواندن دارند.» این یک تنظیم نیست،
 * یک قید است: `viewer` هیچ مسیر نوشتنی نمی‌بیند و هیچ فراخوانی نوشتنی از او
 * پذیرفته نمی‌شود.
 */

export const Role = {
  product: 'product',
  viewer: 'viewer',
} as const;

export type Role = (typeof Role)[keyof typeof Role];

/** نقش‌هایی که اجازهٔ نوشتن دارند. */
export const WRITE_ROLES: readonly Role[] = [Role.product];

export function canWrite(role: Role): boolean {
  return WRITE_ROLES.includes(role);
}

export interface SessionUser {
  id: string;
  displayName: string;
  role: Role;
}

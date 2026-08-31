import { DurableObject } from 'cloudflare:workers';
import type { Env } from '../env';

/**
 * شمارندهٔ سراسری صدور شمارهٔ پیگیری — R-03، FR-016، FR-020.
 *
 * **چرا شماره در لبه صادر می‌شود، نه در هسته** (اصل III): اگر هسته مرجع شماره
 * باشد و در دسترس نباشد، ربات نمی‌تواند شماره بدهد و کل تجربه می‌شکند. این
 * شیء آن وابستگی را کاملاً حذف می‌کند.
 *
 * **چرا `REQ-149` و نه UUID**: آدم‌ها این شماره را در جلسه به زبان می‌آورند
 * («چی شد REQ-149؟»). شناسهٔ ۲۶ کاراکتری این را غیرممکن می‌کند.
 *
 * **چرا یک شیء واحد**: در مقیاس ۳۰ تا ۵۰ ثبت در ماه، رقابت روی یک شمارنده
 * عملاً صفر است. Durable Object به‌ازای هر شیء تک‌رشته‌ای است و «input gate»
 * زمان اجرا، رویداد تازه را تا پایان عملیات ذخیره‌سازی نگه می‌دارد — یعنی دو
 * درخواست هم‌زمان نمی‌توانند یک شماره بگیرند.
 *
 * روی این ضمانت **تکیه نمی‌کنیم، اثباتش می‌کنیم**: آزمون الزامی ۲ (V-7) دقیقاً
 * همین را با ثبت‌های هم‌زمان و بازراه‌اندازی می‌سنجد.
 */

/** نام کلید ذخیره‌سازی. تغییرش یعنی شمارنده از صفر شروع کند — هرگز. */
const LAST_NUMBER_KEY = 'lastNumber';

/** پیشوند شمارهٔ پیگیری. */
export const REQUEST_ID_PREFIX = 'REQ-';

/** نام ثابت شیء شمارنده — سراسری و یکتا. */
export const COUNTER_OBJECT_NAME = 'global';

export class CounterDO extends DurableObject<Env> {
  /**
   * شمارهٔ بعدی را اتمیک صادر می‌کند.
   *
   * `await` روی `put` عمدی است: «output gate» زمان اجرا هر خروجی شبکه را تا
   * تثبیت نوشتن نگه می‌دارد، پس شماره‌ای که به کاربر می‌رسد قطعاً بادوام شده
   * است. بدون این، بازراه‌اندازی می‌توانست شماره‌ای را دوباره صادر کند.
   */
  async issue(): Promise<string> {
    const last = (await this.ctx.storage.get<number>(LAST_NUMBER_KEY)) ?? 0;
    const next = last + 1;
    await this.ctx.storage.put(LAST_NUMBER_KEY, next);
    return `${REQUEST_ID_PREFIX}${next}`;
  }

  /** آخرین شمارهٔ صادرشده، بدون صدور شمارهٔ تازه. */
  async lastIssued(): Promise<number> {
    return (await this.ctx.storage.get<number>(LAST_NUMBER_KEY)) ?? 0;
  }
}

/** عدد را از شمارهٔ پیگیری بیرون می‌کشد، یا `null` اگر قالب نخواند. */
export function parseRequestNumber(requestId: string): number | null {
  if (!requestId.startsWith(REQUEST_ID_PREFIX)) return null;
  const digits = requestId.slice(REQUEST_ID_PREFIX.length);
  if (!/^[1-9][0-9]*$/.test(digits)) return null;
  return Number(digits);
}

/** دسترسی به شیء شمارندهٔ سراسری. */
export function counterStub(env: Env): DurableObjectStub<CounterDO> {
  return env.COUNTER.get(
    env.COUNTER.idFromName(COUNTER_OBJECT_NAME),
  ) as DurableObjectStub<CounterDO>;
}

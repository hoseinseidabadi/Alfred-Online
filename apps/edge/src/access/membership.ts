import {
  type ChatMemberStatus,
  type TelegramResult,
  type ChatMember,
  getChatMember,
} from '../telegram/api';

/**
 * بررسی دسترسی از راه عضویت کانال — R-05، FR-001.
 *
 * نگاشت زیر **حدس نیست**: spike S-1 روی کانال واقعی اجرا شد و هر حالت را
 * سنجید. نتیجه در `specs/001-request-intake-triage/spikes/S-1-access-group-membership.md`.
 *
 * یافتهٔ تعیین‌کنندهٔ آن spike: کاربر غیرعضو `ok: true` با `status: "left"`
 * می‌گیرد، **نه خطا**. یعنی «این آدم عضو نیست» از «تلگرام الان خراب است»
 * قابل تفکیک است — و همین سه‌حالتی بودن، قلب این ماژول است.
 */

/** وضعیت‌هایی که یعنی کاربر عضو کانال است. */
const ALLOWED: readonly ChatMemberStatus[] = ['creator', 'administrator', 'member'];

export type MembershipVerdict =
  /** عضو است — ثبت ادامه می‌یابد. */
  | { access: 'allowed'; status: ChatMemberStatus }
  /** عضو نیست — ثبت رد، پیام راهنمای عضویت (FR-001). */
  | { access: 'denied'; reason: string }
  /**
   * نامعلوم — تلگرام جواب نداد.
   *
   * **MUST NOT به‌عنوان `denied` تفسیر شود.** یک قطعی چندثانیه‌ای تلگرام نباید
   * کارمندان را بیرون بیندازد. مصرف‌کننده باید به استثناهای دستی سقوط کند
   * (`GET /bridge/access/{chatId}`) و اگر آن هم نبود، تصمیم صریح بگیرد.
   */
  | { access: 'unknown'; reason: string; retryAfterSeconds?: number };

/**
 * نتیجهٔ خام Bot API را به حکم دسترسی ترجمه می‌کند.
 *
 * جدا از فراخوانی شبکه نگه داشته شده تا بشود هر حالت را بدون تلگرام آزمود.
 */
export function interpretMembership(result: TelegramResult<ChatMember>): MembershipVerdict {
  switch (result.outcome) {
    case 'ok':
      return ALLOWED.includes(result.result.status)
        ? { access: 'allowed', status: result.result.status }
        : { access: 'denied', reason: `وضعیت عضویت: ${result.result.status}` };

    case 'rejected': {
      const reason = `${result.errorCode}: ${result.description}`;
      // خرابی پیکربندی **ما** با «این آدم عضو نیست» یکی نیست.
      return isOurConfigurationBroken(result.errorCode, result.description)
        ? { access: 'unknown', reason }
        : { access: 'denied', reason };
    }

    case 'unavailable':
      return {
        access: 'unknown',
        reason: result.reason,
        ...(result.retryAfterSeconds !== undefined
          ? { retryAfterSeconds: result.retryAfterSeconds }
          : {}),
      };
  }
}

/** عضویت یک کاربر در کانال را می‌سنجد. */
export async function checkMembership(
  token: string,
  channelId: string,
  userId: number,
  fetchImpl?: typeof fetch,
): Promise<MembershipVerdict> {
  return interpretMembership(await getChatMember(token, channelId, userId, fetchImpl));
}

/**
 * مدت کش نتیجهٔ عضویت.
 *
 * کوتاه است چون منشأ ارزش این رویکرد (R-05) همین است: با ترک سازمان یا خروج
 * از کانال، دسترسی **خودبه‌خود** به‌روز می‌شود. کش بلند همان فهرست دستیِ
 * بیات‌شونده را از در پشتی برمی‌گرداند.
 */
export const MEMBERSHIP_CACHE_TTL_MS = 10 * 60 * 1000;

/**
 * آیا این حکم قابل کش کردن است.
 *
 * **`unknown` هرگز کش نمی‌شود** — قید طراحی spike S-1. وگرنه یک قطعی گذرای
 * تلگرام تا انقضای کش، کاربر را بیرون نگه می‌دارد.
 */
export function isCacheable(verdict: MembershipVerdict): boolean {
  return verdict.access !== 'unknown';
}

/**
 * آیا این رد، خرابیِ **پیکربندی ما**ست نه واقعیتی دربارهٔ کاربر.
 *
 * تفکیکی که در نسخهٔ اول از قلم افتاد و باگ واقعی ساخت: توکن باطل‌شده `401`
 * می‌داد، `401` به `denied` ترجمه می‌شد، و به **هر عضو واقعی** گفته می‌شد
 * «عضو گروه نیستی». دروغی که خودمان ساخته بودیم.
 *
 * دو پیامد دارد و دومی مهم‌تر است:
 *
 *   ۱. پیام درست: «الان نمی‌توانم بررسی کنم» به‌جای «عضو نیستی»
 *   ۲. **کش نمی‌شود.** حکم `denied` ده دقیقه می‌ماند، یعنی حتی پس از درست
 *      کردن توکن، کاربر ده دقیقه بیرون می‌ماند. `unknown` این را ندارد.
 *
 * تصمیم قبلی‌ام دربارهٔ `403` را هم برمی‌گردانم. آن‌موقع استدلال کردم «اگر
 * ادمینی ربات را بردارند نباید کانال برای همه باز شود» — ولی `unknown` هم
 * ثبت را **مسدود می‌کند**؛ فقط پیامش صادق‌تر است و کش نمی‌شود. آن نگرانی
 * بی‌مورد بود.
 */
function isOurConfigurationBroken(errorCode: number, description: string): boolean {
  // توکن باطل یا اشتباه.
  if (errorCode === 401) return true;
  // ربات عضو گروه نیست، یا اجازهٔ لازم را ندارد.
  if (errorCode === 403) return true;
  // شناسهٔ گروه اشتباه است — برخلاف «member not found» که دربارهٔ کاربر است.
  if (errorCode === 400 && /chat not found/i.test(description)) return true;
  return false;
}

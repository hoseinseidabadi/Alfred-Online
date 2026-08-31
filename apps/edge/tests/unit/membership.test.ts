import { describe, expect, it } from 'vitest';
import type { ChatMember, ChatMemberStatus, TelegramResult } from '../../src/telegram/api';
import {
  MEMBERSHIP_CACHE_TTL_MS,
  interpretMembership,
  isCacheable,
} from '../../src/access/membership';

/**
 * نگاشت این آزمون‌ها **حدس نیست** — از خروجی واقعی spike S-1 می‌آید:
 * `specs/001-request-intake-triage/spikes/S-1-channel-membership.md`
 */

const ok = (status: ChatMemberStatus): TelegramResult<ChatMember> => ({
  outcome: 'ok',
  result: { status, user: { id: 1, is_bot: false, first_name: 'حسین' } },
});

describe('عضویت — پاسخ‌های قطعی', () => {
  it.each<ChatMemberStatus>(['creator', 'administrator', 'member'])(
    'وضعیت %s یعنی مجاز',
    (status) => {
      expect(interpretMembership(ok(status))).toEqual({ access: 'allowed', status });
    },
  );

  it.each<ChatMemberStatus>(['left', 'kicked', 'restricted'])('وضعیت %s یعنی رد', (status) => {
    const verdict = interpretMembership(ok(status));
    expect(verdict.access).toBe('denied');
  });

  it('غیرعضو با ok:true و status:left می‌آید، نه با خطا', () => {
    // این دقیقاً همان یافتهٔ تعیین‌کنندهٔ spike S-1 است. اگر تلگرام روزی این
    // رفتار را عوض کند، این آزمون اول می‌شکند نه منطق دسترسی در تولید.
    const verdict = interpretMembership(ok('left'));
    expect(verdict).toEqual({ access: 'denied', reason: 'وضعیت عضویت: left' });
  });

  it('۴۰۰ member not found یعنی رد، نه خرابی', () => {
    const verdict = interpretMembership({
      outcome: 'rejected',
      errorCode: 400,
      description: 'Bad Request: member not found',
    });
    expect(verdict.access).toBe('denied');
  });

  it('۴۰۳ (ربات ادمین نیست) هم رد است، نه «عضو»', () => {
    // اگر این به «مجاز» تفسیر می‌شد، از دست رفتن دسترسی ادمینِ ربات، کانال
    // را برای همه باز می‌کرد.
    const verdict = interpretMembership({
      outcome: 'rejected',
      errorCode: 403,
      description: 'Forbidden: bot is not a member of the channel chat',
    });
    expect(verdict.access).toBe('denied');
  });
});

describe('عضویت — حالت سوم: نامعلوم', () => {
  it('خطای شبکه «نامعلوم» است نه «رد»', () => {
    const verdict = interpretMembership({ outcome: 'unavailable', reason: 'network error' });
    expect(verdict.access).toBe('unknown');
  });

  it('۵xx تلگرام «نامعلوم» است', () => {
    const verdict = interpretMembership({ outcome: 'unavailable', reason: 'HTTP 502' });
    expect(verdict.access).toBe('unknown');
  });

  it('محدودیت نرخ «نامعلوم» است و مدت انتظار را حمل می‌کند', () => {
    const verdict = interpretMembership({
      outcome: 'unavailable',
      reason: 'محدودیت نرخ',
      retryAfterSeconds: 12,
    });
    expect(verdict).toEqual({ access: 'unknown', reason: 'محدودیت نرخ', retryAfterSeconds: 12 });
  });

  it('هیچ حالت خرابی به «رد» ترجمه نمی‌شود', () => {
    // قید طراحی spike S-1. اگر بشکند، یک قطعی گذرای تلگرام همهٔ کارمندان را
    // بیرون می‌اندازد و ثبت متوقف می‌شود.
    for (const reason of ['timeout', 'HTTP 500', 'HTTP 503', 'fetch failed']) {
      expect(interpretMembership({ outcome: 'unavailable', reason }).access).toBe('unknown');
    }
  });
});

describe('کش کردن حکم', () => {
  it('حکم‌های قطعی کش می‌شوند', () => {
    expect(isCacheable(interpretMembership(ok('member')))).toBe(true);
    expect(isCacheable(interpretMembership(ok('left')))).toBe(true);
  });

  it('«نامعلوم» هرگز کش نمی‌شود', () => {
    // وگرنه یک قطعی چندثانیه‌ای تلگرام تا انقضای کش کاربر را بیرون نگه می‌دارد.
    const unknown = interpretMembership({ outcome: 'unavailable', reason: 'timeout' });
    expect(isCacheable(unknown)).toBe(false);
  });

  it('کش کوتاه است تا دسترسی خودبه‌خود به‌روز بماند', () => {
    // R-05: ارزش این رویکرد همین است که با خروج از کانال، دسترسی خودش
    // می‌رود. کش بلند همان فهرست دستیِ بیات‌شونده را برمی‌گرداند.
    expect(MEMBERSHIP_CACHE_TTL_MS).toBeLessThanOrEqual(15 * 60 * 1000);
  });
});

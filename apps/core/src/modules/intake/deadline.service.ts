import { Inject, Injectable, Optional } from '@nestjs/common';
import { addDays } from '@alfred-online/jalali';

/**
 * تعهد پاسخ، ناوردای سامانه است — اصل IV.
 *
 * دو چیز اینجا حساب می‌شود و هر دو **مشتق‌اند، نه ذخیره‌شدهٔ دستی**:
 *
 *   `responseDueAt`  مهلت مطلق: `submittedAt + 7d`
 *   `atRisk`         آیا **پیش از** نقض، باید هشدار داد
 *
 * چرا `atRisk` مشتق است نه یک پرچم: پرچمی که کسی باید بزند، روزی زده نمی‌شود.
 * مهلت هفت‌روزه ناوردای سامانه است، نه یادداشتی روی دیوار.
 */

/** تعهد هفت‌روزه — از منشور P-06 و اصل IV. */
export const RESPONSE_COMMITMENT_DAYS = 7;

/**
 * چند روز مانده به مهلت، درخواست «در معرض نقض» علامت می‌خورد.
 *
 * دو روز از سناریوی پذیرش US2 می‌آید: «درخواستی دو روز تا پایان مهلت دارد →
 * به‌عنوان در معرض نقض تعهد مشخص می‌شود». عددش اینجا یک ثابتِ نام‌دار است تا
 * اگر سازمان بعداً خواست زودتر هشدار بگیرد، یک جا عوض شود.
 */
export const AT_RISK_THRESHOLD_DAYS = 2;

/**
 * منبع زمان، تزریق‌شونده.
 *
 * بدون این، آزمون مهلت باید هفت روز صبر کند یا ساعت سیستم را دست‌کاری کند.
 * Technical Context برنامه صراحتاً «زمان تزریق‌شونده» را الزام کرده تا
 * آزمون‌های مهلت و جهش زمانی قطعی باشند.
 */
export const CLOCK = Symbol('CLOCK');

export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

@Injectable()
export class DeadlineService {
  private readonly clock: Clock;

  constructor(@Optional() @Inject(CLOCK) clock?: Clock) {
    this.clock = clock ?? systemClock;
  }

  /**
   * مهلت پاسخ را از زمان ثبت مشتق می‌کند.
   *
   * **مطلق است، نه تقویمی**: هفت روز یعنی ۱۶۸ ساعت، نه «هفت بار عوض شدن تاریخ
   * تهران». قرارداد bridge-api هم همین را می‌گوید: `submittedAt + 7d`.
   */
  dueAt(submittedAt: Date): Date {
    return addDays(submittedAt, RESPONSE_COMMITMENT_DAYS);
  }

  /** چند روز کامل تا مهلت مانده. منفی یعنی تعهد نقض شده. */
  daysRemaining(responseDueAt: Date, now: Date = this.clock.now()): number {
    return Math.floor((responseDueAt.getTime() - now.getTime()) / 86_400_000);
  }

  /**
   * آیا این درخواست باید **پیش از** نقض تعهد برجسته شود — FR-030.
   *
   * درخواستی که مهلتش گذشته هم `atRisk` است. ممکن است در نگاه اول عجیب باشد
   * («دیگر که نقض شده»)، ولی جایگزینش بدتر است: درخواست نقض‌شده از فهرست
   * هشدارها **ناپدید می‌شود** و دقیقاً همان چیزی که بیشترین توجه را لازم دارد
   * نامرئی می‌گردد.
   */
  isAtRisk(responseDueAt: Date, now: Date = this.clock.now()): boolean {
    return this.daysRemaining(responseDueAt, now) <= AT_RISK_THRESHOLD_DAYS;
  }

  /** آیا تعهد نقض شده — برای شمارش `slaBreaches` در گزارش دوره. */
  isBreached(responseDueAt: Date, respondedAt: Date | null, now: Date = this.clock.now()): boolean {
    const settled = respondedAt ?? now;
    return settled.getTime() > responseDueAt.getTime();
  }

  /** هر سه مقدارِ رو به تریاژ، یک‌جا. */
  status(submittedAt: Date, now: Date = this.clock.now()) {
    const responseDueAt = this.dueAt(submittedAt);
    return {
      responseDueAt,
      daysRemaining: this.daysRemaining(responseDueAt, now),
      atRisk: this.isAtRisk(responseDueAt, now),
    };
  }
}

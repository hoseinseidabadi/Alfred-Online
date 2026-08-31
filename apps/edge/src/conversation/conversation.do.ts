import { DurableObject } from 'cloudflare:workers';
import type { Env } from '../env';
import type { Unit } from '@alfred-online/contracts';
import {
  type Attachment,
  type ConversationState,
  type TransitionResult,
  addAttachment,
  answer,
  cancel,
  confirm,
  currentQuestion,
  initialState,
  isExpired,
  isInProgress,
  skipAttachments,
  start,
} from './state-machine';
import type { Question } from './questions';

/**
 * حالت گفت‌وگوی هر کاربر — R-02، FR-013، FR-014.
 *
 * **چرا Durable Object و نه KV** (R-02): گفت‌وگوی پرسش‌وپاسخ سریع است — کاربر
 * ظرف چند ثانیه جواب می‌دهد. KV سازگاری نهایی دارد و خواندن پس از نوشتن
 * می‌تواند مقدار کهنه بدهد؛ آن‌وقت کاربر همان سوال را دوباره می‌بیند یا
 * جوابش گم می‌شود. Durable Object سازگاری قوی و اجرای تک‌رشته‌ای به‌ازای هر
 * شیء می‌دهد، و هر شیء طبیعتاً به یک کاربر محدود است.
 *
 * این کلاس عمداً **فقط نگهدارندهٔ حالت** است. تمام منطق گذار در
 * `state-machine.ts` است که تابع محض است. آزمون الزامی ۴ (V-6) باید بتواند
 * «حالت خراب شد» را از «منطق خراب شد» تفکیک کند.
 */

/** کلید ذخیره‌سازی حالت گفت‌وگو. */
const STATE_KEY = 'conversation';

/**
 * کلید جداگانهٔ واحد سازمانی.
 *
 * عمداً از حالت گفت‌وگو جداست: واحد **از عمر گفت‌وگو بلندتر است** (FR-003).
 * اگر داخل حالت می‌ماند، لغو یا انقضای گفت‌وگو آن را هم پاک می‌کرد و کاربر
 * دوباره همان سوال را می‌گرفت.
 */
const UNIT_KEY = 'unit';

export interface ConversationSnapshot {
  state: ConversationState;
  question: Question | null;
  expired: boolean;
}

export class ConversationDO extends DurableObject<Env> {
  /**
   * شناسهٔ این **نمونه** در حافظه — نه شناسهٔ شیء.
   *
   * فقط برای آزمون: با هر بازراه‌اندازی عوض می‌شود. بدون آن، آزمون بقای
   * گفت‌وگو (V-6) می‌توانست بی‌آنکه معلوم شود بی‌محتوا باشد — چون `load` هر
   * بار از ذخیره‌سازی می‌خواند و آزمون حتی **بدون** بازراه‌اندازی هم سبز
   * می‌شد. این فیلد ثابت می‌کند شیء واقعاً از نو ساخته شده است.
   */
  readonly instanceId: string = crypto.randomUUID();

  /** حالت جاری را می‌خواند و در صورت انقضا علامتش می‌زند. */
  async snapshot(now: number = Date.now()): Promise<ConversationSnapshot> {
    const state = await this.load(now);
    return {
      state,
      question: currentQuestion(state),
      expired: isInProgress(state) && isExpired(state, now),
    };
  }

  /**
   * گفت‌وگوی تازه شروع می‌کند.
   *
   * اگر گفت‌وگویی در جریان باشد، **بی‌صدا جایگزینش نمی‌کند** — `needsConfirm`
   * برمی‌گرداند تا کاربر بین ادامه و شروع تازه انتخاب کند. سناریوی لبهٔ «چند
   * ثبت همزمان» در spec دقیقاً همین را می‌خواهد.
   */
  async begin(
    now: number = Date.now(),
  ): Promise<
    | { needsConfirm: true; current: Question | null }
    | { needsConfirm: false; question: Question | null }
  > {
    const state = await this.load(now);

    if (isInProgress(state) && !isExpired(state, now)) {
      return { needsConfirm: true, current: currentQuestion(state) };
    }

    const started = start(state, now);
    await this.save(started);
    return { needsConfirm: false, question: currentQuestion(started) };
  }

  /** گفت‌وگوی در جریان را دور می‌ریزد و تازه شروع می‌کند. */
  async restart(now: number = Date.now()): Promise<Question | null> {
    const state = await this.load(now);
    const started = start(state, now);
    await this.save(started);
    return currentQuestion(started);
  }

  /** پاسخ کاربر را می‌پذیرد. */
  async submitAnswer(raw: string, now: number = Date.now()): Promise<TransitionResult> {
    const state = await this.load(now);
    const result = answer(state, raw, now);
    if (result.ok) await this.save(result.state);
    return result;
  }

  async attach(attachment: Attachment, now: number = Date.now()): Promise<ConversationState> {
    const next = addAttachment(await this.load(now), attachment, now);
    await this.save(next);
    return next;
  }

  async finishAttachments(now: number = Date.now()): Promise<ConversationState> {
    const next = skipAttachments(await this.load(now), now);
    await this.save(next);
    return next;
  }

  async markSubmitted(now: number = Date.now()): Promise<ConversationState> {
    const next = confirm(await this.load(now), now);
    await this.save(next);
    return next;
  }

  async abandon(now: number = Date.now()): Promise<ConversationState> {
    const next = cancel(await this.load(now), now);
    await this.save(next);
    return next;
  }

  /** نتیجهٔ بررسی عضویت را کش می‌کند — T033 مصرفش می‌کند. */
  async cacheMembership(ok: boolean, checkedAt: number, ttlMs: number): Promise<void> {
    await this.ctx.storage.put('membership', { ok, checkedAt, expiresAt: checkedAt + ttlMs });
  }

  /** نتیجهٔ کش‌شدهٔ عضویت، یا `null` اگر نبود یا منقضی شده. */
  async cachedMembership(now: number = Date.now()): Promise<boolean | null> {
    const cached = await this.ctx.storage.get<{ ok: boolean; expiresAt: number }>('membership');
    if (cached === undefined || cached.expiresAt <= now) return null;
    return cached.ok;
  }

  // ── ذخیره‌سازی ────────────────────────────────────────────────────────────

  private async load(now: number): Promise<ConversationState> {
    const stored = await this.ctx.storage.get<ConversationState>(STATE_KEY);
    if (stored !== undefined) return stored;

    // گفت‌وگوی تازه، ولی واحد سازمانی ممکن است از قبل باشد.
    const unit = await this.ctx.storage.get<Unit>(UNIT_KEY);
    return initialState(unit, now);
  }

  /**
   * `await` روی نوشتن عمدی است: «output gate» زمان اجرا خروجی شبکه را تا
   * تثبیت نوشتن نگه می‌دارد، پس پرسشی که کاربر می‌بیند حتماً با حالتِ
   * بادوام‌شده می‌خواند. همین چیزی است که V-6 می‌سنجد.
   */
  private async save(state: ConversationState): Promise<void> {
    await this.ctx.storage.put(STATE_KEY, state);
    // واحد جدا هم نوشته می‌شود تا از عمر گفت‌وگو بیشتر بماند.
    if (state.unit !== undefined) await this.ctx.storage.put(UNIT_KEY, state.unit);
  }
}

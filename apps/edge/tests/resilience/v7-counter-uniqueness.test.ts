import { env, evictDurableObject, runInDurableObject } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  type CounterDO,
  REQUEST_ID_PREFIX,
  parseRequestNumber,
} from '../../src/counter/counter.do';

/**
 * ✅ آزمون الزامی ۲ — **یکتایی شمارهٔ پیگیری در برابر بازراه‌اندازی لبه**
 *
 * قانون اساسی، بند «تاب‌آوری و آزمون»، مورد دوم:
 *   «یکتایی شمارهٔ پیگیری در سراسر بازراه‌اندازی لایهٔ لبه حفظ می‌شود.»
 *
 * سناریوی متناظر: **V-7** در `quickstart.md`
 *   «چند ثبت هم‌زمان + ری‌استارت لبه → انتظار: هیچ شمارهٔ تکراری، هیچ شکاف
 *    پرش‌دار.»
 *
 * راهبرد از R-12: آزمون روی Durable Object با بازراه‌اندازی شبیه‌سازی‌شده.
 * `evictDurableObject` شیء را از حافظه بیرون می‌اندازد؛ فراخوانی بعدی آن را
 * از نو می‌سازد و مجبورش می‌کند حالت را از ذخیره‌سازی بادوام بخواند. این
 * نزدیک‌ترین چیز به یک استقرار تازه یا جابه‌جایی شیء بین ماشین‌هاست.
 *
 * شکست این آزمون یعنی دو نفر یک شمارهٔ پیگیری می‌گیرند — یعنی FR-020
 * («شماره تا پایان عمر درخواست تغییر نمی‌کند») بی‌معنا می‌شود.
 */

const counterId = () => env.COUNTER.idFromName('global');
const counter = () => env.COUNTER.get(counterId()) as DurableObjectStub<CounterDO>;

/**
 * شیء را از حافظه بیرون می‌اندازد — شبیه‌سازی بازراه‌اندازی لبه.
 *
 * اگر شیء اصلاً در حال اجرا نباشد، `evictDurableObject` خطا می‌دهد. از دید
 * سامانه آن حالت **همان** حالت مطلوب است (شیء در حافظه نیست)، پس بلعیده
 * می‌شود؛ بقیهٔ خطاها بالا می‌روند.
 */
const restartEdge = async (): Promise<void> => {
  try {
    await evictDurableObject(counter());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('not currently running')) throw error;
  }
};

describe('✅ آزمون الزامی ۲ — یکتایی شماره پس از بازراه‌اندازی (V-7)', () => {
  beforeEach(async () => {
    // هر آزمون از شمارندهٔ پاک شروع می‌شود تا اعداد قابل پیش‌بینی باشند.
    await runInDurableObject(counter(), async (_instance, state) => {
      await state.storage.deleteAll();
    });
  });

  it('شماره‌ها از یک شروع می‌شوند و پشت‌سرهم می‌آیند', async () => {
    const stub = counter();
    expect(await stub.issue()).toBe('REQ-1');
    expect(await stub.issue()).toBe('REQ-2');
    expect(await stub.issue()).toBe('REQ-3');
  });

  it('ثبت‌های هم‌زمان هیچ شمارهٔ تکراری نمی‌گیرند', async () => {
    const stub = counter();
    const CONCURRENT = 50;

    // همه با هم، بدون انتظار بین‌شان — دقیقاً همان چیزی که «input gate»
    // زمان اجرا باید سریالش کند.
    const issued = await Promise.all(Array.from({ length: CONCURRENT }, () => stub.issue()));

    expect(new Set(issued).size).toBe(CONCURRENT);
  });

  it('ثبت‌های هم‌زمان هیچ شکافی نمی‌سازند', async () => {
    const stub = counter();
    const CONCURRENT = 50;

    const issued = await Promise.all(Array.from({ length: CONCURRENT }, () => stub.issue()));
    const numbers = issued.map(parseRequestNumber).sort((a, b) => (a ?? 0) - (b ?? 0));

    // ۱ تا ۵۰، بدون جای خالی. شکاف یعنی شماره‌ای صادر شده و گم شده.
    expect(numbers).toEqual(Array.from({ length: CONCURRENT }, (_, i) => i + 1));
  });

  it('پس از بازراه‌اندازی، شمارش از همان‌جا ادامه می‌یابد', async () => {
    const before = await counter().issue();
    expect(before).toBe('REQ-1');

    await restartEdge();

    const after = await counter().issue();
    expect(after).toBe('REQ-2');
  });

  it('سناریوی V-7 — ثبت هم‌زمان، بازراه‌اندازی، ثبت هم‌زمان دوباره', async () => {
    const BATCH = 20;

    const first = await Promise.all(Array.from({ length: BATCH }, () => counter().issue()));
    await restartEdge();
    const second = await Promise.all(Array.from({ length: BATCH }, () => counter().issue()));

    const all = [...first, ...second];

    // هیچ تکراری — حتی یکی، حتی از دو سوی بازراه‌اندازی.
    expect(new Set(all).size).toBe(BATCH * 2);

    // هیچ شکاف پرش‌دار — دنبالهٔ کامل ۱ تا ۴۰.
    const numbers = all.map(parseRequestNumber).sort((a, b) => (a ?? 0) - (b ?? 0));
    expect(numbers).toEqual(Array.from({ length: BATCH * 2 }, (_, i) => i + 1));
  });

  it('چند بازراه‌اندازی پشت‌سرهم هم شمارنده را عقب نمی‌برد', async () => {
    const issued: string[] = [];
    for (let round = 0; round < 5; round++) {
      issued.push(await counter().issue());
      await restartEdge();
    }
    expect(issued).toEqual(['REQ-1', 'REQ-2', 'REQ-3', 'REQ-4', 'REQ-5']);
  });

  it('بازراه‌اندازی بدون هیچ صدوری، شمارنده را صفر نمی‌کند', async () => {
    await counter().issue();
    await counter().issue();
    await restartEdge();
    await restartEdge();

    const state = await runInDurableObject(counter(), (instance: CounterDO) =>
      instance.lastIssued(),
    );
    expect(state).toBe(2);
  });
});

describe('parseRequestNumber', () => {
  it('شمارهٔ معتبر را می‌خواند', () => {
    expect(parseRequestNumber('REQ-149')).toBe(149);
  });

  it('قالب نامعتبر را رد می‌کند به‌جای اینکه NaN بدهد', () => {
    for (const invalid of ['149', 'REQ-', 'REQ-abc', 'REQ-0', 'REQ-01', 'RSP-1', '']) {
      expect(parseRequestNumber(invalid)).toBeNull();
    }
  });

  it('پیشوند همان چیزی است که در قرارداد آمده', () => {
    expect(REQUEST_ID_PREFIX).toBe('REQ-');
  });
});

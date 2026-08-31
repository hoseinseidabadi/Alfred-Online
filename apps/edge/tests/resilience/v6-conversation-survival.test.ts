import { env, evictDurableObject, runInDurableObject } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ConversationDO } from '../../src/conversation/conversation.do';

/**
 * ✅ آزمون الزامی ۴ — **بقای گفت‌وگوی نیمه‌تمام در برابر بازراه‌اندازی**
 *
 * قانون اساسی، بند «تاب‌آوری و آزمون»، مورد چهارم:
 *   «یک گفت‌وگوی در جریان از بازراه‌اندازی سرویس جان سالم به در می‌برد.»
 *
 * سناریوی متناظر: **V-6** در `quickstart.md`
 *   «وسط سوال سوم، لبه را ری‌استارت کن → انتظار: کاربر از همان سوال ادامه
 *    می‌دهد.»
 *
 * راهبرد از R-12: آزمون Durable Object با بازراه‌اندازی وسط ماشین حالت.
 *
 * چرا این مهم است: کاربری که وسط ثبت، پاسخ‌هایش را از دست بدهد، دفعهٔ بعد
 * سراغ ربات نمی‌آید — و کل ارزش «نقطهٔ ورود واحد» از بین می‌رود.
 */

const conversation = (chatId: string) =>
  env.CONVERSATION.get(env.CONVERSATION.idFromName(chatId)) as DurableObjectStub<ConversationDO>;

/** شیء را از حافظه بیرون می‌اندازد — شبیه‌سازی بازراه‌اندازی لبه. */
const restartEdge = async (chatId: string): Promise<void> => {
  try {
    await evictDurableObject(conversation(chatId));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('not currently running')) throw error;
  }
};

const CHAT = 'chat-v6';

/** گفت‌وگو را تا وسط پرسش‌های خرابی جلو می‌برد. */
const advanceToThirdQuestion = async (chatId: string) => {
  const stub = conversation(chatId);
  await stub.begin();
  await stub.submitAnswer('editorial'); // واحد
  await stub.submitAnswer('bug'); // نوع
  await stub.submitAnswer('وب‌سایت'); // پرسش ۱ — where
  await stub.submitAnswer('صفحهٔ خبر رو باز کردم، ساعت شلوغی عصر'); // پرسش ۲ — action
  return stub;
};

describe('✅ آزمون الزامی ۴ — بقای گفت‌وگوی نیمه‌تمام (V-6)', () => {
  beforeEach(async () => {
    await runInDurableObject(conversation(CHAT), async (_i, state) => {
      await state.storage.deleteAll();
    });
  });

  it('پیش‌شرط آزمون — بازراه‌اندازی واقعاً شیء را از نو می‌سازد', async () => {
    // بدون این، آزمون‌های زیر می‌توانستند بی‌محتوا باشند: `load` هر بار از
    // ذخیره‌سازی می‌خواند، پس حتی **بدون** بازراه‌اندازی هم سبز می‌شدند.
    await advanceToThirdQuestion(CHAT);

    const idBefore = await runInDurableObject(
      conversation(CHAT),
      (instance: ConversationDO) => instance.instanceId,
    );
    await restartEdge(CHAT);
    const idAfter = await runInDurableObject(
      conversation(CHAT),
      (instance: ConversationDO) => instance.instanceId,
    );

    expect(idAfter).not.toBe(idBefore);
  });

  it('سناریوی V-6 — بازراه‌اندازی وسط سوال سوم، ادامه از همان سوال', async () => {
    await advanceToThirdQuestion(CHAT);

    const before = await conversation(CHAT).snapshot();
    expect(before.question?.key).toBe('observed'); // پرسش سوم خرابی

    await restartEdge(CHAT);

    const after = await conversation(CHAT).snapshot();
    // **همان** سوال، نه سوال اول، نه سوال بعدی.
    expect(after.question?.key).toBe('observed');
    expect(after.state.step).toBe('askContent');
    expect(after.state.contentIndex).toBe(before.state.contentIndex);
  });

  it('پاسخ‌های داده‌شده پس از بازراه‌اندازی دست‌نخورده می‌مانند', async () => {
    await advanceToThirdQuestion(CHAT);
    await restartEdge(CHAT);

    const { state } = await conversation(CHAT).snapshot();
    expect(state.answers).toEqual({
      where: 'وب‌سایت',
      action: 'صفحهٔ خبر رو باز کردم، ساعت شلوغی عصر',
    });
    expect(state.requestType).toBe('bug');
    expect(state.unit).toBe('editorial');
  });

  it('گفت‌وگو پس از بازراه‌اندازی تا انتها پیش می‌رود', async () => {
    const stub = await advanceToThirdQuestion(CHAT);
    await restartEdge(CHAT);

    // ادامهٔ همان گفت‌وگو، انگار هیچ اتفاقی نیفتاده.
    await conversation(CHAT).submitAnswer('خطای ۵۰۲ داد؛ انتظار داشتم خبر باز شود');
    await conversation(CHAT).submitAnswer('this_week');
    await conversation(CHAT).submitAnswer('few_people');
    await conversation(CHAT).submitAnswer('برای خواننده صفحه اصلاً باز نمی‌شود');

    const { state, question } = await conversation(CHAT).snapshot();
    expect(question).toBeNull();
    expect(state.step).toBe('askAttachment');
    expect(Object.keys(state.answers).sort()).toEqual([
      'action',
      'observed',
      'roleQuestion',
      'scope',
      'since',
      'where',
    ]);
    expect(stub).toBeDefined();
  });

  it('چند بازراه‌اندازی پشت‌سرهم هم حالت را خراب نمی‌کند', async () => {
    await advanceToThirdQuestion(CHAT);

    for (let i = 0; i < 4; i++) {
      await restartEdge(CHAT);
      const { question } = await conversation(CHAT).snapshot();
      expect(question?.key).toBe('observed');
    }
  });

  it('بازراه‌اندازی وسط پرسش نقش هم بی‌اثر است', async () => {
    await advanceToThirdQuestion(CHAT);
    await conversation(CHAT).submitAnswer('خطای ۵۰۲ داد');
    await conversation(CHAT).submitAnswer('today');
    await conversation(CHAT).submitAnswer('many');

    const before = await conversation(CHAT).snapshot();
    expect(before.question?.key).toBe('roleQuestion');

    await restartEdge(CHAT);

    const after = await conversation(CHAT).snapshot();
    expect(after.question?.key).toBe('roleQuestion');
    // پرسش نقش با واحد تحریریه همان چیزی است که منشور P-06 می‌گوید.
    expect(after.question?.prompt).toContain('کار روزانهٔ تو');
  });

  it('واحد سازمانی از عمر گفت‌وگو بیشتر می‌ماند — FR-003', async () => {
    const stub = conversation('chat-unit-persist');
    await runInDurableObject(stub, async (_i, state) => {
      await state.storage.deleteAll();
    });

    await stub.begin();
    await stub.submitAnswer('technical');
    await stub.abandon(); // گفت‌وگو لغو شد
    await restartEdge('chat-unit-persist');

    // ثبت بعدی نباید دوباره واحد را بپرسد.
    const next = await conversation('chat-unit-persist').begin();
    expect(next.needsConfirm).toBe(false);
    if (!next.needsConfirm) expect(next.question?.key).toBe('requestType');
  });
});

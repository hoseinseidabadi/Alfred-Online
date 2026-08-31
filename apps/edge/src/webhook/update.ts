/**
 * تجزیهٔ ورودی webhook تلگرام.
 *
 * فقط همان بخش‌هایی از `Update` تعریف شده که سامانه واقعاً استفاده می‌کند.
 * تایپ کردن کل Bot API نه ممکن است نه لازم — و هر فیلد اضافی که تایپ شود،
 * یک ادعای نگه‌داشتنی است که کسی راستی‌آزمایی‌اش نمی‌کند.
 *
 * خروجی این ماژول عمداً **مستقل از تلگرام** است: `ParsedUpdate` دربارهٔ
 * «چه کسی چه کاری کرد» حرف می‌زند، نه دربارهٔ شکل JSON تلگرام. همان مرزی که
 * آداپتور مقصد در سوی خروجی نگه می‌دارد (R-13).
 */

interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
}

interface TelegramChat {
  id: number;
  type: string;
}

interface TelegramPhotoSize {
  file_id: string;
  file_size?: number;
}

interface TelegramDocument {
  file_id: string;
  file_name?: string;
  file_size?: number;
}

interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  text?: string;
  caption?: string;
  photo?: TelegramPhotoSize[];
  document?: TelegramDocument;
}

interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

/** دستورهایی که سامانه می‌شناسد. */
export type Command = 'start' | 'cancel' | 'help';

export type ParsedUpdate =
  | { kind: 'command'; command: Command; actor: Actor }
  /** متن آزاد یا انتخاب یک گزینه — از دید ماشین حالت یکی است. */
  | { kind: 'answer'; value: string; actor: Actor; callbackId?: string }
  | { kind: 'attachment'; attachment: ParsedAttachment; actor: Actor }
  /** استعلام وضعیت با شمارهٔ پیگیری — FR-035. */
  | { kind: 'statusQuery'; requestId: string; actor: Actor }
  | { kind: 'ignored'; reason: string };

export interface Actor {
  /** شناسهٔ گفت‌وگوی خصوصی — کلید شیء گفت‌وگو. */
  chatId: string;
  /** شناسهٔ کاربر — چیزی که `getChatMember` می‌خواهد. */
  userId: number;
  displayName: string;
}

export interface ParsedAttachment {
  kind: 'photo' | 'document' | 'link';
  ref: string;
  sizeBytes?: number;
}

/** بیشینهٔ اندازهٔ پیوست. بزرگ‌تر پیام روشن می‌گیرد و ثبت بدون آن ادامه می‌یابد (FR-011). */
export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;

const COMMANDS: Record<string, Command> = {
  '/start': 'start',
  '/cancel': 'cancel',
  '/help': 'help',
};

/** الگوی شمارهٔ پیگیری در متن آزاد. */
const REQUEST_ID_PATTERN = /^REQ-([1-9][0-9]*)$/i;

export function parseUpdate(update: TelegramUpdate): ParsedUpdate {
  if (update.callback_query !== undefined) return parseCallback(update.callback_query);
  if (update.message !== undefined) return parseMessage(update.message);
  // ویرایش پیام، عضویت کانال، و بقیهٔ رویدادها — عمداً نادیده.
  return { kind: 'ignored', reason: 'نوع بروزرسانی پشتیبانی نمی‌شود' };
}

function parseCallback(query: TelegramCallbackQuery): ParsedUpdate {
  const actor = toActor(query.from, query.message?.chat.id);
  if (actor === null) return { kind: 'ignored', reason: 'گفت‌وگوی خصوصی نیست' };
  if (query.data === undefined || query.data.length === 0) {
    return { kind: 'ignored', reason: 'callback بدون داده' };
  }
  return { kind: 'answer', value: query.data, actor, callbackId: query.id };
}

function parseMessage(message: TelegramMessage): ParsedUpdate {
  // فقط گفت‌وگوی خصوصی. پیام کانال و گروه به این سامانه ربطی ندارد.
  if (message.chat.type !== 'private') {
    return { kind: 'ignored', reason: 'فقط گفت‌وگوی خصوصی' };
  }

  const actor = toActor(message.from, message.chat.id);
  if (actor === null) return { kind: 'ignored', reason: 'فرستنده نامشخص' };

  if (message.photo !== undefined && message.photo.length > 0) {
    // بزرگ‌ترین اندازه آخرین قلم آرایه است.
    const largest = message.photo[message.photo.length - 1];
    if (largest !== undefined) {
      return {
        kind: 'attachment',
        attachment: { kind: 'photo', ref: largest.file_id, sizeBytes: largest.file_size },
        actor,
      };
    }
  }

  if (message.document !== undefined) {
    return {
      kind: 'attachment',
      attachment: {
        kind: 'document',
        ref: message.document.file_id,
        sizeBytes: message.document.file_size,
      },
      actor,
    };
  }

  const text = (message.text ?? message.caption ?? '').trim();
  if (text.length === 0) return { kind: 'ignored', reason: 'پیام خالی' };

  const command = COMMANDS[text.split(/\s+/)[0]?.toLowerCase() ?? ''];
  if (command !== undefined) return { kind: 'command', command, actor };

  const asRequestId = REQUEST_ID_PATTERN.exec(text);
  if (asRequestId !== null) {
    return { kind: 'statusQuery', requestId: text.toUpperCase(), actor };
  }

  if (isLink(text)) {
    return { kind: 'attachment', attachment: { kind: 'link', ref: text }, actor };
  }

  return { kind: 'answer', value: text, actor };
}

function toActor(user: TelegramUser | undefined, chatId: number | undefined): Actor | null {
  if (user === undefined || chatId === undefined) return null;
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
  return {
    chatId: String(chatId),
    userId: user.id,
    displayName: name.length > 0 ? name : (user.username ?? String(user.id)),
  };
}

function isLink(text: string): boolean {
  return /^https?:\/\/\S+$/i.test(text);
}

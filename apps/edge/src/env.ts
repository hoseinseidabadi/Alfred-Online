export interface Env {
  DB: D1Database;
  CONVERSATION: DurableObjectNamespace;
  COUNTER: DurableObjectNamespace;
  ENVIRONMENT: string;
  // اسرار — از `.dev.vars` محلی یا Secret Store در استقرار
  TELEGRAM_TOKEN: string;
  WEBHOOK_SECRET: string;
  BRIDGE_KEY: string;
  CORE_URL: string;
  CHANNEL_ID: string;
  /**
   * شناسهٔ گفت‌وگوی مدیر محصول — تنها حسابی که میز تریاژ برایش باز است.
   *
   * یک متغیر، نه جدول نقش: تعداد تریاژگر امروز **یک** است و ساختن جدول برای
   * یک ردیف، همان بیش‌مهندسی‌ای است که اصل VII منع کرده. وقتی دومی آمد،
   * تبدیلش به جدول یک مهاجرت است.
   */
  PRODUCT_MANAGER_CHAT_ID: string;
}

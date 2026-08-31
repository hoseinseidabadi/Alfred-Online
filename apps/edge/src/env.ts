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
}

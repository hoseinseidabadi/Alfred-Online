-- صف دوطرفهٔ بادوام لبه — R-04، اصل III.
--
-- این دو جدول تنها چیزی هستند که میان «ثبت کامل شد» و «هسته خبردار شد» می‌ایستند.
-- در قطعی چند روزه، همه‌چیز اینجا انباشته می‌شود و کاربر هیچ تفاوتی حس نمی‌کند.
--
-- دو قاعده در هر دو جدول:
--   ۱. کلید اصلی همان شناسهٔ idempotency است — تلاش مجدد MUST رکورد تکراری نسازد
--      (FR-017، FR-018). درج دوباره روی همان کلید شکست می‌خورد، نه تکرار.
--   ۲. هیچ مسیر DELETE — ناوردای ۹. رکورد تحویل‌شده فقط علامت می‌خورد.

-- ── ثبت‌ها: از لبه به هسته ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS edge_submission (
  -- `REQ-NNN` — در شمارندهٔ Durable Object صادر شده. کلید idempotency پل.
  request_id      TEXT PRIMARY KEY,

  chat_id         TEXT    NOT NULL,
  submitter_name  TEXT    NOT NULL,
  unit            TEXT    NOT NULL,
  request_type    TEXT    NOT NULL,

  -- عین متن فارسی، به‌صورت JSON. **تغییرناپذیر** — اصل II، ناوردای ۱.
  raw_answers     TEXT    NOT NULL,
  attachments     TEXT    NOT NULL DEFAULT '[]',

  -- میلی‌ثانیهٔ UTC. مبدأ مهلت هفت‌روزه و **کلید ترتیب تحویل**.
  submitted_at    INTEGER NOT NULL,

  -- خالی = هنوز در صف خروجی. این تنها فیلدی است که پس از درج عوض می‌شود.
  delivered_to_core_at INTEGER,

  delivery_attempts INTEGER NOT NULL DEFAULT 0,
  last_error        TEXT,

  CONSTRAINT edge_submission_type_valid
    CHECK (request_type IN ('bug', 'improvement', 'idea')),
  CONSTRAINT edge_submission_unit_valid
    CHECK (unit IN ('editorial', 'technical', 'commercial', 'management', 'other'))
);

-- تحویل MUST به‌ترتیب `submitted_at` باشد (FR-017). این ایندکس همان پرس‌وجوی
-- داغِ هر چرخهٔ Cron است: «تحویل‌نشده‌ها، قدیمی‌ترین اول».
CREATE INDEX IF NOT EXISTS idx_edge_submission_pending
  ON edge_submission (submitted_at)
  WHERE delivered_to_core_at IS NULL;

-- ── پاسخ‌ها: از هسته به کاربر ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS outbound_response (
  -- `RSP-NNNN` — کلید idempotency. تا نرسیدن ack، هسته همین را دوباره می‌دهد؛
  -- کلید اصلی جلوی ارسال دوبارهٔ پیام به کاربر را می‌گیرد.
  response_id     TEXT PRIMARY KEY,

  request_id      TEXT    NOT NULL,
  chat_id         TEXT    NOT NULL,

  -- متن **آماده و نهایی**. لبه MUST NOT بازنویسی یا خلاصه‌اش کند.
  body            TEXT    NOT NULL,

  fetched_from_core_at INTEGER NOT NULL,
  -- خالی = هنوز به کاربر نرسیده. پس از پر شدن، ack به هسته می‌رود.
  sent_to_user_at      INTEGER,

  send_attempts   INTEGER NOT NULL DEFAULT 0,
  last_error      TEXT
);

CREATE INDEX IF NOT EXISTS idx_outbound_response_pending
  ON outbound_response (fetched_from_core_at)
  WHERE sent_to_user_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_outbound_response_request
  ON outbound_response (request_id);

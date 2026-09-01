-- صف تصمیم‌های تریاژ: از لبه به هسته — جهت سومِ پل.
--
-- تا اینجا پل دو جهت داشت: ثبت‌ها (لبه→هسته) و پاسخ‌ها (هسته→لبه). میز تریاژ
-- تلگرامی جهت سوم را لازم دارد: تصمیمی که مدیر محصول از گوشی می‌گیرد.
--
-- **چرا صف و نه تماس مستقیم** (اصل III): اگر پاسخ منتظر تأیید هسته بماند، در
-- قطعی گیر می‌کند و ثبت‌کننده جوابش را نمی‌گیرد. لبه اعتبارسنجی را خودش
-- انجام می‌دهد، بلافاصله تحویل می‌دهد، و تصمیم را اینجا می‌گذارد تا Cron
-- برساند.
--
-- پیامدش: هسته ممکن است تا چند دقیقه بعد از ثبت‌کننده خبردار شود. این پذیرفته
-- شده — همان معامله‌ای که اصل III برای کل سامانه کرده.

CREATE TABLE IF NOT EXISTS triage_decision (
  -- `RSP-NNNN` — در لبه صادر می‌شود، مثل شمارهٔ پیگیری. کلید idempotency.
  response_id     TEXT PRIMARY KEY,

  request_id      TEXT    NOT NULL,
  -- گیرندهٔ پاسخ. جدا نگه داشته می‌شود تا تحویل به رکورد ثبت وابسته نباشد.
  chat_id         TEXT    NOT NULL,

  -- convert | merge | reject | need_data
  outcome         TEXT    NOT NULL,
  -- متن نهاییِ رسیده به ثبت‌کننده. **عیناً همان چیزی که فرستاده شد.**
  body            TEXT    NOT NULL,

  -- سه بخش رد — وقتی outcome = reject هر سه پر هستند (FR-031).
  reject_understood TEXT,
  reject_why_not    TEXT,
  reject_when_yes   TEXT,

  -- چه کسی تأیید کرد. هرگز خالی نیست (FR-033).
  approved_by     TEXT    NOT NULL,
  decided_at      INTEGER NOT NULL,

  -- لحظه‌ای که به ثبت‌کننده رسید. تحویل **پیش از** رسیدن به هسته انجام می‌شود.
  delivered_to_user_at INTEGER,
  -- خالی = هنوز به هسته نرسیده.
  delivered_to_core_at INTEGER,

  delivery_attempts INTEGER NOT NULL DEFAULT 0,
  last_error        TEXT,

  CONSTRAINT triage_decision_outcome_valid
    CHECK (outcome IN ('convert', 'merge', 'reject', 'need_data')),
  -- ناوردای FR-031 در سطح جدول: رد بدون هر سه بخش اصلاً ذخیره نمی‌شود.
  CONSTRAINT triage_decision_reject_complete CHECK (
    outcome <> 'reject' OR (
      reject_understood IS NOT NULL AND length(trim(reject_understood)) > 0 AND
      reject_why_not    IS NOT NULL AND length(trim(reject_why_not))    > 0 AND
      reject_when_yes   IS NOT NULL AND length(trim(reject_when_yes))   > 0
    )
  ),
  -- ناوردای FR-033: هیچ پاسخی بدون تأیید انسان.
  CONSTRAINT triage_decision_approved CHECK (length(trim(approved_by)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_triage_decision_pending
  ON triage_decision (decided_at)
  WHERE delivered_to_core_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_triage_decision_request
  ON triage_decision (request_id);

-- شمارندهٔ شمارهٔ پاسخ. مثل شمارهٔ پیگیری در لبه صادر می‌شود تا میز تریاژ
-- بدون هسته هم کار کند.
CREATE TABLE IF NOT EXISTS response_counter (
  id           INTEGER PRIMARY KEY CHECK (id = 1),
  last_number  INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO response_counter (id, last_number) VALUES (1, 0);

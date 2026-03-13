-- ---------------------------------------------------------------------------
-- 009: Communication System — Email preferences, logging, action tokens
-- (SQLite variant)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS email_preferences (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  weekly_digest   INTEGER NOT NULL DEFAULT 1,
  monthly_close   INTEGER NOT NULL DEFAULT 1,
  urgent_alerts   INTEGER NOT NULL DEFAULT 1,
  quarterly_tax   INTEGER NOT NULL DEFAULT 1,
  timezone        TEXT NOT NULL DEFAULT 'UTC',
  digest_day      TEXT NOT NULL DEFAULT 'monday',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_email_preferences_user
  ON email_preferences (user_id);

CREATE TABLE IF NOT EXISTS email_log (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id),
  email_type  TEXT NOT NULL,
  subject     TEXT NOT NULL,
  sent_at     TEXT NOT NULL DEFAULT (datetime('now')),
  resend_id   TEXT,
  metadata    TEXT
);

CREATE INDEX IF NOT EXISTS idx_email_log_user
  ON email_log (user_id, email_type, sent_at);

CREATE TABLE IF NOT EXISTS email_action_tokens (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id),
  action      TEXT NOT NULL,
  payload     TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  used_at     TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_email_action_tokens_user
  ON email_action_tokens (user_id, action);

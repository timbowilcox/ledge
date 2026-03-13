-- ---------------------------------------------------------------------------
-- 009: Communication System — Email preferences, logging, action tokens
--
-- Email-first communication system for weekly digests, monthly close prompts,
-- urgent alerts, and onboarding sequences. All emails include action links
-- that let users act from their inbox without logging in.
-- ---------------------------------------------------------------------------

-- Email preferences — per-user notification settings
CREATE TABLE IF NOT EXISTS email_preferences (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  weekly_digest   BOOLEAN NOT NULL DEFAULT true,
  monthly_close   BOOLEAN NOT NULL DEFAULT true,
  urgent_alerts   BOOLEAN NOT NULL DEFAULT true,
  quarterly_tax   BOOLEAN NOT NULL DEFAULT true,
  timezone        TEXT NOT NULL DEFAULT 'UTC',
  digest_day      TEXT NOT NULL DEFAULT 'monday',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_email_preferences_user
  ON email_preferences (user_id);

-- Email log — record of every email sent
CREATE TABLE IF NOT EXISTS email_log (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id),
  email_type  TEXT NOT NULL,
  subject     TEXT NOT NULL,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  resend_id   TEXT,
  metadata    JSONB
);

CREATE INDEX IF NOT EXISTS idx_email_log_user
  ON email_log (user_id, email_type, sent_at);

-- Email action tokens — signed, single-use tokens for email action links
CREATE TABLE IF NOT EXISTS email_action_tokens (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id),
  action      TEXT NOT NULL,
  payload     JSONB NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_action_tokens_user
  ON email_action_tokens (user_id, action);

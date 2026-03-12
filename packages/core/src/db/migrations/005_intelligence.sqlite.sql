-- Ledge: Migration 005 — Intelligence Layer (SQLite)
-- Adds notifications and notification preferences for insights, alerts, and anomalies.
-- SQLite does not enforce enum values; constraints are application-level.

-- ---------------------------------------------------------------------------
-- Notifications — insights, alerts, and actionable items
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS notifications (
  id                TEXT PRIMARY KEY,
  ledger_id         TEXT NOT NULL REFERENCES ledgers(id),
  user_id           TEXT NOT NULL REFERENCES users(id),
  type              TEXT NOT NULL,
  severity          TEXT NOT NULL DEFAULT 'info',
  title             TEXT NOT NULL,
  body              TEXT NOT NULL,
  data              TEXT NOT NULL DEFAULT '{}',
  action_type       TEXT,
  action_data       TEXT,
  status            TEXT NOT NULL DEFAULT 'unread',
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  read_at           TEXT,
  actioned_at       TEXT
);

CREATE INDEX IF NOT EXISTS idx_notifications_ledger_user
  ON notifications (ledger_id, user_id, status);
CREATE INDEX IF NOT EXISTS idx_notifications_created
  ON notifications (ledger_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type
  ON notifications (ledger_id, type, created_at DESC);

-- ---------------------------------------------------------------------------
-- Notification preferences — per-user opt-in/out per notification type
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS notification_preferences (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL REFERENCES users(id),
  ledger_id         TEXT NOT NULL REFERENCES ledgers(id),
  type              TEXT NOT NULL,
  enabled           INTEGER NOT NULL DEFAULT 1,
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  UNIQUE(user_id, ledger_id, type)
);

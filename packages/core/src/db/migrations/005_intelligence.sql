-- Ledge: Migration 005 — Intelligence Layer
-- Adds notifications and notification preferences for insights, alerts, and anomalies.

-- ---------------------------------------------------------------------------
-- Custom types for notifications
-- ---------------------------------------------------------------------------

CREATE TYPE notification_type AS ENUM (
  'monthly_summary',
  'cash_position',
  'anomaly',
  'unclassified_transactions',
  'sync_complete',
  'reconciliation_needed',
  'system'
);

CREATE TYPE notification_severity AS ENUM ('info', 'warning', 'critical');
CREATE TYPE notification_status AS ENUM ('unread', 'read', 'dismissed', 'actioned');

-- ---------------------------------------------------------------------------
-- Notifications — insights, alerts, and actionable items
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS notifications (
  id                TEXT PRIMARY KEY,
  ledger_id         TEXT NOT NULL REFERENCES ledgers(id),
  user_id           TEXT NOT NULL REFERENCES users(id),
  type              notification_type NOT NULL,
  severity          notification_severity NOT NULL DEFAULT 'info',
  title             TEXT NOT NULL,
  body              TEXT NOT NULL,
  data              JSONB NOT NULL DEFAULT '{}',
  action_type       TEXT,
  action_data       JSONB,
  status            notification_status NOT NULL DEFAULT 'unread',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at           TIMESTAMPTZ,
  actioned_at       TIMESTAMPTZ
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
  type              notification_type NOT NULL,
  enabled           BOOLEAN NOT NULL DEFAULT true,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, ledger_id, type)
);

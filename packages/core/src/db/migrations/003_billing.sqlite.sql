-- Ledge: Migration 003 — Billing (SQLite)
-- Adds plan enforcement, usage tracking, and Stripe integration columns.
-- SQLite does not enforce enum values, so no ALTER TYPE needed.

-- ---------------------------------------------------------------------------
-- Billing columns on users
-- ---------------------------------------------------------------------------

ALTER TABLE users ADD COLUMN plan TEXT NOT NULL DEFAULT 'free';
ALTER TABLE users ADD COLUMN stripe_customer_id TEXT;
ALTER TABLE users ADD COLUMN stripe_subscription_id TEXT;
ALTER TABLE users ADD COLUMN plan_period_start TEXT;
ALTER TABLE users ADD COLUMN plan_period_end TEXT;

-- ---------------------------------------------------------------------------
-- Usage tracking per ledger per billing period
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS usage_periods (
  id                TEXT PRIMARY KEY,
  ledger_id         TEXT NOT NULL REFERENCES ledgers(id),
  period_start      TEXT NOT NULL,
  period_end        TEXT NOT NULL,
  transaction_count INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  UNIQUE (ledger_id, period_start)
);

CREATE INDEX IF NOT EXISTS idx_usage_periods_ledger
  ON usage_periods (ledger_id, period_start);

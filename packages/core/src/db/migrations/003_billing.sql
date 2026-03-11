-- Ledge: Migration 003 — Billing
-- Adds plan enforcement, usage tracking, and Stripe integration columns.

-- ---------------------------------------------------------------------------
-- Add 'pending' to transaction_status enum
-- ---------------------------------------------------------------------------

ALTER TYPE transaction_status ADD VALUE IF NOT EXISTS 'pending';

-- ---------------------------------------------------------------------------
-- Billing columns on users
-- ---------------------------------------------------------------------------

ALTER TABLE users ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free';
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_period_start TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_period_end TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- Usage tracking per ledger per billing period
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS usage_periods (
  id                TEXT PRIMARY KEY,
  ledger_id         TEXT NOT NULL REFERENCES ledgers(id),
  period_start      DATE NOT NULL,
  period_end        DATE NOT NULL,
  transaction_count INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ledger_id, period_start)
);

CREATE INDEX IF NOT EXISTS idx_usage_periods_ledger
  ON usage_periods (ledger_id, period_start);

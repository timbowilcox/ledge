-- ---------------------------------------------------------------------------
-- 006 — Multi-currency support (SQLite)
--
-- Adds per-line-item currency tracking, exchange rates, and currency settings.
-- ---------------------------------------------------------------------------

-- ── New tables ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS currency_settings (
  id              TEXT PRIMARY KEY,
  ledger_id       TEXT NOT NULL REFERENCES ledgers(id) ON DELETE CASCADE,
  currency_code   TEXT NOT NULL,
  decimal_places  INTEGER NOT NULL DEFAULT 2 CHECK (decimal_places BETWEEN 0 AND 4),
  symbol          TEXT NOT NULL DEFAULT '',
  enabled         INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (ledger_id, currency_code)
);

CREATE INDEX IF NOT EXISTS idx_currency_settings_ledger ON currency_settings (ledger_id);

CREATE TABLE IF NOT EXISTS exchange_rates (
  id              TEXT PRIMARY KEY,
  ledger_id       TEXT NOT NULL REFERENCES ledgers(id) ON DELETE CASCADE,
  from_currency   TEXT NOT NULL,
  to_currency     TEXT NOT NULL,
  rate            INTEGER NOT NULL CHECK (rate > 0),
  effective_date  TEXT NOT NULL,
  source          TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'api', 'import')),
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (ledger_id, from_currency, to_currency, effective_date)
);

CREATE INDEX IF NOT EXISTS idx_exchange_rates_lookup
  ON exchange_rates (ledger_id, from_currency, to_currency, effective_date DESC);

-- ── Alter line_items ───────────────────────────────────────────────────
-- SQLite does not support ALTER COLUMN SET NOT NULL, so we add with defaults
-- and backfill. The application layer enforces NOT NULL on new inserts.

ALTER TABLE line_items ADD COLUMN currency TEXT NOT NULL DEFAULT '';
ALTER TABLE line_items ADD COLUMN original_amount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE line_items ADD COLUMN exchange_rate INTEGER;

-- Backfill existing rows
UPDATE line_items
SET currency = (
  SELECT l.currency FROM transactions t
  JOIN ledgers l ON l.id = t.ledger_id
  WHERE t.id = line_items.transaction_id
),
original_amount = amount;

-- ── Alter accounts ─────────────────────────────────────────────────────

ALTER TABLE accounts ADD COLUMN currency TEXT;

-- ── Seed currency_settings for each existing ledger ────────────────────

INSERT OR IGNORE INTO currency_settings (id, ledger_id, currency_code, decimal_places, symbol, enabled, created_at, updated_at)
SELECT
  lower(hex(randomblob(16))),
  id,
  currency,
  2,
  CASE currency
    WHEN 'USD' THEN '$'
    WHEN 'EUR' THEN '€'
    WHEN 'GBP' THEN '£'
    WHEN 'JPY' THEN '¥'
    WHEN 'AUD' THEN 'A$'
    WHEN 'CAD' THEN 'C$'
    ELSE currency
  END,
  1,
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM ledgers;

-- Ledge: Migration 004 — Bank Feeds
-- Adds bank connections, bank accounts, bank transactions, and sync log tables.
-- Supports Basiq (AU/NZ) and Plaid (US/UK/EU stub) providers.

-- ---------------------------------------------------------------------------
-- Custom types for bank feeds
-- ---------------------------------------------------------------------------

CREATE TYPE bank_connection_status AS ENUM ('active', 'stale', 'disconnected', 'error');
CREATE TYPE bank_sync_status AS ENUM ('running', 'completed', 'failed');
CREATE TYPE bank_transaction_type AS ENUM ('credit', 'debit');
CREATE TYPE bank_transaction_status AS ENUM ('pending', 'matched', 'posted', 'ignored');

-- ---------------------------------------------------------------------------
-- Bank connections — one per institution link
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS bank_connections (
  id                      TEXT PRIMARY KEY,
  ledger_id               TEXT NOT NULL REFERENCES ledgers(id),
  provider                TEXT NOT NULL,
  provider_connection_id  TEXT NOT NULL,
  institution_id          TEXT NOT NULL,
  institution_name        TEXT NOT NULL,
  status                  bank_connection_status NOT NULL DEFAULT 'active',
  consent_expires_at      TIMESTAMPTZ,
  last_sync_at            TIMESTAMPTZ,
  metadata                JSONB,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bank_connections_ledger
  ON bank_connections (ledger_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_connections_provider
  ON bank_connections (provider, provider_connection_id);

-- ---------------------------------------------------------------------------
-- Bank accounts — linked to a connection, optionally mapped to a ledger account
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS bank_accounts (
  id                      TEXT PRIMARY KEY,
  connection_id           TEXT NOT NULL REFERENCES bank_connections(id) ON DELETE CASCADE,
  ledger_id               TEXT NOT NULL REFERENCES ledgers(id),
  provider_account_id     TEXT NOT NULL,
  name                    TEXT NOT NULL,
  account_number          TEXT NOT NULL,
  bsb                     TEXT,
  type                    TEXT NOT NULL DEFAULT 'transaction',
  currency                TEXT NOT NULL DEFAULT 'AUD',
  current_balance         BIGINT NOT NULL DEFAULT 0,
  available_balance       BIGINT,
  mapped_account_id       TEXT REFERENCES accounts(id),
  last_sync_at            TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bank_accounts_connection
  ON bank_accounts (connection_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_ledger
  ON bank_accounts (ledger_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_accounts_provider
  ON bank_accounts (connection_id, provider_account_id);

-- ---------------------------------------------------------------------------
-- Bank transactions — raw feed data, matched/posted to ledger transactions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS bank_transactions (
  id                        TEXT PRIMARY KEY,
  bank_account_id           TEXT NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  ledger_id                 TEXT NOT NULL REFERENCES ledgers(id),
  provider_transaction_id   TEXT NOT NULL,
  date                      DATE NOT NULL,
  amount                    BIGINT NOT NULL,
  type                      bank_transaction_type NOT NULL,
  description               TEXT NOT NULL,
  reference                 TEXT,
  category                  TEXT,
  balance                   BIGINT,
  status                    bank_transaction_status NOT NULL DEFAULT 'pending',
  matched_transaction_id    TEXT REFERENCES transactions(id),
  match_confidence          REAL,
  raw_data                  JSONB NOT NULL DEFAULT '{}',
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bank_transactions_account
  ON bank_transactions (bank_account_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_ledger
  ON bank_transactions (ledger_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_date
  ON bank_transactions (bank_account_id, date);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_status
  ON bank_transactions (ledger_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_transactions_provider
  ON bank_transactions (bank_account_id, provider_transaction_id);

-- ---------------------------------------------------------------------------
-- Bank sync log — tracks each sync operation
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS bank_sync_log (
  id                      TEXT PRIMARY KEY,
  connection_id           TEXT NOT NULL REFERENCES bank_connections(id) ON DELETE CASCADE,
  bank_account_id         TEXT REFERENCES bank_accounts(id) ON DELETE SET NULL,
  status                  bank_sync_status NOT NULL DEFAULT 'running',
  transactions_fetched    INTEGER NOT NULL DEFAULT 0,
  transactions_new        INTEGER NOT NULL DEFAULT 0,
  transactions_matched    INTEGER NOT NULL DEFAULT 0,
  error_message           TEXT,
  started_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at            TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_bank_sync_log_connection
  ON bank_sync_log (connection_id, started_at DESC);

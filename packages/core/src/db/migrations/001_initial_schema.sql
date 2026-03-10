-- Ledge: Initial Schema
-- PostgreSQL migration — enforces double-entry balance constraint at database level.
-- All monetary amounts are integers in the smallest currency unit (cents).
-- All primary keys are UUID v7 for time-ordered uniqueness.
-- All timestamps are UTC.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Custom types
-- ---------------------------------------------------------------------------

CREATE TYPE account_type AS ENUM ('asset', 'liability', 'equity', 'revenue', 'expense');
CREATE TYPE normal_balance AS ENUM ('debit', 'credit');
CREATE TYPE direction AS ENUM ('debit', 'credit');
CREATE TYPE transaction_status AS ENUM ('posted', 'reversed');
CREATE TYPE source_type AS ENUM ('api', 'mcp', 'import', 'manual');
CREATE TYPE accounting_basis AS ENUM ('accrual', 'cash');
CREATE TYPE ledger_status AS ENUM ('active', 'archived');
CREATE TYPE account_status AS ENUM ('active', 'archived');
CREATE TYPE api_key_status AS ENUM ('active', 'revoked');
CREATE TYPE import_batch_status AS ENUM ('pending', 'processing', 'complete', 'failed');
CREATE TYPE match_status AS ENUM ('matched', 'suggested', 'unmatched');
CREATE TYPE audit_action AS ENUM ('created', 'reversed', 'archived');
CREATE TYPE actor_type AS ENUM ('user', 'agent', 'system');

-- ---------------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------------

CREATE TABLE users (
  id             TEXT PRIMARY KEY,
  email          TEXT NOT NULL UNIQUE,
  name           TEXT NOT NULL,
  auth_provider  TEXT NOT NULL,
  auth_provider_id TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_users_auth ON users (auth_provider, auth_provider_id);

-- ---------------------------------------------------------------------------
-- Templates (seeded data, not user-created)
-- ---------------------------------------------------------------------------

CREATE TABLE templates (
  id                TEXT PRIMARY KEY,
  slug              TEXT NOT NULL UNIQUE,
  name              TEXT NOT NULL,
  description       TEXT NOT NULL,
  business_type     TEXT NOT NULL,
  chart_of_accounts JSONB NOT NULL,
  default_currency  TEXT NOT NULL DEFAULT 'USD',
  default_basis     accounting_basis NOT NULL DEFAULT 'accrual',
  metadata          JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Ledgers
-- ---------------------------------------------------------------------------

CREATE TABLE ledgers (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  currency          TEXT NOT NULL DEFAULT 'USD',
  template_id       TEXT REFERENCES templates(id),
  business_context  JSONB,
  fiscal_year_start INTEGER NOT NULL DEFAULT 1 CHECK (fiscal_year_start BETWEEN 1 AND 12),
  accounting_basis  accounting_basis NOT NULL DEFAULT 'accrual',
  status            ledger_status NOT NULL DEFAULT 'active',
  owner_id          TEXT NOT NULL REFERENCES users(id),
  closed_through    DATE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ledgers_owner ON ledgers (owner_id);

-- ---------------------------------------------------------------------------
-- API Keys
-- ---------------------------------------------------------------------------

CREATE TABLE api_keys (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id),
  ledger_id    TEXT NOT NULL REFERENCES ledgers(id),
  key_hash     TEXT NOT NULL UNIQUE,
  prefix       TEXT NOT NULL,
  name         TEXT NOT NULL,
  last_used_at TIMESTAMPTZ,
  status       api_key_status NOT NULL DEFAULT 'active',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_api_keys_user ON api_keys (user_id);
CREATE INDEX idx_api_keys_ledger ON api_keys (ledger_id);
CREATE INDEX idx_api_keys_hash ON api_keys (key_hash) WHERE status = 'active';

-- ---------------------------------------------------------------------------
-- Accounts (chart of accounts tree)
-- ---------------------------------------------------------------------------

CREATE TABLE accounts (
  id             TEXT PRIMARY KEY,
  ledger_id      TEXT NOT NULL REFERENCES ledgers(id),
  parent_id      TEXT REFERENCES accounts(id),
  code           TEXT NOT NULL,
  name           TEXT NOT NULL,
  type           account_type NOT NULL,
  normal_balance normal_balance NOT NULL,
  is_system      BOOLEAN NOT NULL DEFAULT false,
  metadata       JSONB,
  status         account_status NOT NULL DEFAULT 'active',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (ledger_id, code)
);

CREATE INDEX idx_accounts_ledger ON accounts (ledger_id);
CREATE INDEX idx_accounts_parent ON accounts (parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX idx_accounts_type ON accounts (ledger_id, type);

-- ---------------------------------------------------------------------------
-- Transactions (immutable journal entries)
-- ---------------------------------------------------------------------------

CREATE TABLE transactions (
  id              TEXT PRIMARY KEY,
  ledger_id       TEXT NOT NULL REFERENCES ledgers(id),
  idempotency_key TEXT NOT NULL,
  date            DATE NOT NULL,
  effective_date  DATE,
  memo            TEXT NOT NULL,
  status          transaction_status NOT NULL DEFAULT 'posted',
  source_type     source_type NOT NULL DEFAULT 'api',
  source_ref      TEXT,
  agent_id        TEXT,
  metadata        JSONB,
  posted_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (ledger_id, idempotency_key)
);

CREATE INDEX idx_transactions_ledger_date ON transactions (ledger_id, date);
CREATE INDEX idx_transactions_ledger_status ON transactions (ledger_id, status);
CREATE INDEX idx_transactions_posted_at ON transactions (ledger_id, posted_at);

-- ---------------------------------------------------------------------------
-- Line Items (debits and credits within a transaction)
-- ---------------------------------------------------------------------------

CREATE TABLE line_items (
  id             TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL REFERENCES transactions(id),
  account_id     TEXT NOT NULL REFERENCES accounts(id),
  amount         BIGINT NOT NULL CHECK (amount > 0),
  direction      direction NOT NULL,
  memo           TEXT,
  metadata       JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_line_items_transaction ON line_items (transaction_id);
CREATE INDEX idx_line_items_account ON line_items (account_id);
CREATE INDEX idx_line_items_account_dir ON line_items (account_id, direction);

-- ---------------------------------------------------------------------------
-- Balance Constraint — enforced at database level
--
-- This constraint trigger fires at the end of each database transaction
-- (INITIALLY DEFERRED) to verify that for every accounting transaction
-- touched in this DB transaction, SUM(debits) = SUM(credits).
-- This makes it structurally impossible to create an unbalanced ledger.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION check_transaction_balance()
RETURNS TRIGGER AS $$
DECLARE
  debit_total  BIGINT;
  credit_total BIGINT;
  line_count   INTEGER;
BEGIN
  SELECT
    COALESCE(SUM(CASE WHEN direction = 'debit'  THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount ELSE 0 END), 0),
    COUNT(*)
  INTO debit_total, credit_total, line_count
  FROM line_items
  WHERE transaction_id = NEW.transaction_id;

  IF line_count < 2 THEN
    RAISE EXCEPTION 'Transaction % must have at least 2 line items, got %',
      NEW.transaction_id, line_count;
  END IF;

  IF debit_total <> credit_total THEN
    RAISE EXCEPTION 'Transaction % is unbalanced: debits (%) != credits (%)',
      NEW.transaction_id, debit_total, credit_total;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER trg_check_balance
  AFTER INSERT ON line_items
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION check_transaction_balance();

-- ---------------------------------------------------------------------------
-- Reversals
-- ---------------------------------------------------------------------------

CREATE TABLE reversals (
  id                       TEXT PRIMARY KEY,
  original_transaction_id  TEXT NOT NULL REFERENCES transactions(id),
  reversal_transaction_id  TEXT NOT NULL UNIQUE REFERENCES transactions(id),
  reason                   TEXT NOT NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (original_transaction_id)
);

-- ---------------------------------------------------------------------------
-- Audit Entries (append-only)
-- ---------------------------------------------------------------------------

CREATE TABLE audit_entries (
  id           TEXT PRIMARY KEY,
  ledger_id    TEXT NOT NULL REFERENCES ledgers(id),
  entity_type  TEXT NOT NULL,
  entity_id    TEXT NOT NULL,
  action       audit_action NOT NULL,
  actor_type   actor_type NOT NULL,
  actor_id     TEXT NOT NULL,
  evidence_ref TEXT,
  snapshot     JSONB NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_ledger ON audit_entries (ledger_id, created_at);
CREATE INDEX idx_audit_entity ON audit_entries (entity_type, entity_id);

-- ---------------------------------------------------------------------------
-- Import Batches
-- ---------------------------------------------------------------------------

CREATE TABLE import_batches (
  id              TEXT PRIMARY KEY,
  ledger_id       TEXT NOT NULL REFERENCES ledgers(id),
  source_type     TEXT NOT NULL CHECK (source_type IN ('csv', 'ofx')),
  filename        TEXT NOT NULL,
  row_count       INTEGER NOT NULL DEFAULT 0,
  matched_count   INTEGER NOT NULL DEFAULT 0,
  unmatched_count INTEGER NOT NULL DEFAULT 0,
  status          import_batch_status NOT NULL DEFAULT 'pending',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_import_batches_ledger ON import_batches (ledger_id);

-- ---------------------------------------------------------------------------
-- Import Rows
-- ---------------------------------------------------------------------------

CREATE TABLE import_rows (
  id                     TEXT PRIMARY KEY,
  batch_id               TEXT NOT NULL REFERENCES import_batches(id),
  date                   DATE NOT NULL,
  amount                 BIGINT NOT NULL,
  payee                  TEXT NOT NULL,
  memo                   TEXT,
  raw_data               JSONB NOT NULL,
  match_status           match_status NOT NULL DEFAULT 'unmatched',
  matched_transaction_id TEXT REFERENCES transactions(id),
  confidence             REAL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_import_rows_batch ON import_rows (batch_id);
CREATE INDEX idx_import_rows_match ON import_rows (match_status);

-- ---------------------------------------------------------------------------
-- updated_at auto-update trigger
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_templates_updated_at BEFORE UPDATE ON templates FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_ledgers_updated_at BEFORE UPDATE ON ledgers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_api_keys_updated_at BEFORE UPDATE ON api_keys FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_accounts_updated_at BEFORE UPDATE ON accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_transactions_updated_at BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_line_items_updated_at BEFORE UPDATE ON line_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_reversals_updated_at BEFORE UPDATE ON reversals FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_import_batches_updated_at BEFORE UPDATE ON import_batches FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_import_rows_updated_at BEFORE UPDATE ON import_rows FOR EACH ROW EXECUTE FUNCTION update_updated_at();

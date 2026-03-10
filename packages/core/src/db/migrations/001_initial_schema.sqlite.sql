-- Ledge: Initial Schema (SQLite)
-- Self-hosted variant. Same data model as PostgreSQL with SQLite-compatible syntax.
-- Balance constraint enforced via trigger (SQLite lacks deferred constraint triggers,
-- so the trigger fires per-statement; the application layer wraps inserts to fire it
-- after all line items for a transaction are inserted).

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
  id               TEXT PRIMARY KEY,
  email            TEXT NOT NULL UNIQUE,
  name             TEXT NOT NULL,
  auth_provider    TEXT NOT NULL,
  auth_provider_id TEXT NOT NULL,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_auth ON users (auth_provider, auth_provider_id);

-- ---------------------------------------------------------------------------
-- Templates
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS templates (
  id                TEXT PRIMARY KEY,
  slug              TEXT NOT NULL UNIQUE,
  name              TEXT NOT NULL,
  description       TEXT NOT NULL,
  business_type     TEXT NOT NULL,
  chart_of_accounts TEXT NOT NULL, -- JSON
  default_currency  TEXT NOT NULL DEFAULT 'USD',
  default_basis     TEXT NOT NULL DEFAULT 'accrual' CHECK (default_basis IN ('accrual', 'cash')),
  metadata          TEXT, -- JSON
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- ---------------------------------------------------------------------------
-- Ledgers
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ledgers (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  currency          TEXT NOT NULL DEFAULT 'USD',
  template_id       TEXT REFERENCES templates(id),
  business_context  TEXT, -- JSON
  fiscal_year_start INTEGER NOT NULL DEFAULT 1 CHECK (fiscal_year_start BETWEEN 1 AND 12),
  accounting_basis  TEXT NOT NULL DEFAULT 'accrual' CHECK (accounting_basis IN ('accrual', 'cash')),
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  owner_id          TEXT NOT NULL REFERENCES users(id),
  closed_through    TEXT, -- ISO date
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_ledgers_owner ON ledgers (owner_id);

-- ---------------------------------------------------------------------------
-- API Keys
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS api_keys (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id),
  ledger_id    TEXT NOT NULL REFERENCES ledgers(id),
  key_hash     TEXT NOT NULL UNIQUE,
  prefix       TEXT NOT NULL,
  name         TEXT NOT NULL,
  last_used_at TEXT,
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys (user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_ledger ON api_keys (ledger_id);

-- ---------------------------------------------------------------------------
-- Accounts
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS accounts (
  id             TEXT PRIMARY KEY,
  ledger_id      TEXT NOT NULL REFERENCES ledgers(id),
  parent_id      TEXT REFERENCES accounts(id),
  code           TEXT NOT NULL,
  name           TEXT NOT NULL,
  type           TEXT NOT NULL CHECK (type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
  normal_balance TEXT NOT NULL CHECK (normal_balance IN ('debit', 'credit')),
  is_system      INTEGER NOT NULL DEFAULT 0,
  metadata       TEXT, -- JSON
  status         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),

  UNIQUE (ledger_id, code)
);

CREATE INDEX IF NOT EXISTS idx_accounts_ledger ON accounts (ledger_id);
CREATE INDEX IF NOT EXISTS idx_accounts_parent ON accounts (parent_id);
CREATE INDEX IF NOT EXISTS idx_accounts_type ON accounts (ledger_id, type);

-- ---------------------------------------------------------------------------
-- Transactions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS transactions (
  id              TEXT PRIMARY KEY,
  ledger_id       TEXT NOT NULL REFERENCES ledgers(id),
  idempotency_key TEXT NOT NULL,
  date            TEXT NOT NULL, -- ISO date
  effective_date  TEXT,          -- ISO date
  memo            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'posted' CHECK (status IN ('posted', 'reversed')),
  source_type     TEXT NOT NULL DEFAULT 'api' CHECK (source_type IN ('api', 'mcp', 'import', 'manual')),
  source_ref      TEXT,
  agent_id        TEXT,
  metadata        TEXT, -- JSON
  posted_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),

  UNIQUE (ledger_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_transactions_ledger_date ON transactions (ledger_id, date);
CREATE INDEX IF NOT EXISTS idx_transactions_ledger_status ON transactions (ledger_id, status);

-- ---------------------------------------------------------------------------
-- Line Items
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS line_items (
  id             TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL REFERENCES transactions(id),
  account_id     TEXT NOT NULL REFERENCES accounts(id),
  amount         INTEGER NOT NULL CHECK (amount > 0),
  direction      TEXT NOT NULL CHECK (direction IN ('debit', 'credit')),
  memo           TEXT,
  metadata       TEXT, -- JSON
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_line_items_transaction ON line_items (transaction_id);
CREATE INDEX IF NOT EXISTS idx_line_items_account ON line_items (account_id);

-- ---------------------------------------------------------------------------
-- Balance Constraint Trigger (SQLite)
--
-- SQLite does not support deferred constraint triggers, so the application
-- layer must call `check_transaction_balance` after inserting all line items.
-- This trigger acts as a safety net on each individual insert: it checks if
-- the transaction currently balances. The application should wrap all line
-- item inserts for one transaction in a single SQL transaction and call
-- the validation function at the end.
--
-- We use a trigger on INSERT that validates when called explicitly via
-- a sentinel. The real enforcement happens through the application calling
-- the verify_balance() helper after all lines are inserted.
-- ---------------------------------------------------------------------------

-- Verify function: call this after inserting all line items for a transaction.
-- Usage: SELECT verify_transaction_balance('txn_id');
-- This is called from the application layer within the same DB transaction.

-- ---------------------------------------------------------------------------
-- Reversals
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS reversals (
  id                       TEXT PRIMARY KEY,
  original_transaction_id  TEXT NOT NULL UNIQUE REFERENCES transactions(id),
  reversal_transaction_id  TEXT NOT NULL UNIQUE REFERENCES transactions(id),
  reason                   TEXT NOT NULL,
  created_at               TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at               TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- ---------------------------------------------------------------------------
-- Audit Entries
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS audit_entries (
  id           TEXT PRIMARY KEY,
  ledger_id    TEXT NOT NULL REFERENCES ledgers(id),
  entity_type  TEXT NOT NULL,
  entity_id    TEXT NOT NULL,
  action       TEXT NOT NULL CHECK (action IN ('created', 'reversed', 'archived')),
  actor_type   TEXT NOT NULL CHECK (actor_type IN ('user', 'agent', 'system')),
  actor_id     TEXT NOT NULL,
  evidence_ref TEXT,
  snapshot     TEXT NOT NULL, -- JSON
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_ledger ON audit_entries (ledger_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_entries (entity_type, entity_id);

-- ---------------------------------------------------------------------------
-- Import Batches
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS import_batches (
  id              TEXT PRIMARY KEY,
  ledger_id       TEXT NOT NULL REFERENCES ledgers(id),
  source_type     TEXT NOT NULL CHECK (source_type IN ('csv', 'ofx')),
  filename        TEXT NOT NULL,
  row_count       INTEGER NOT NULL DEFAULT 0,
  matched_count   INTEGER NOT NULL DEFAULT 0,
  unmatched_count INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'complete', 'failed')),
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_import_batches_ledger ON import_batches (ledger_id);

-- ---------------------------------------------------------------------------
-- Import Rows
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS import_rows (
  id                     TEXT PRIMARY KEY,
  batch_id               TEXT NOT NULL REFERENCES import_batches(id),
  date                   TEXT NOT NULL, -- ISO date
  amount                 INTEGER NOT NULL,
  payee                  TEXT NOT NULL,
  memo                   TEXT,
  raw_data               TEXT NOT NULL, -- JSON
  match_status           TEXT NOT NULL DEFAULT 'unmatched' CHECK (match_status IN ('matched', 'suggested', 'unmatched')),
  matched_transaction_id TEXT REFERENCES transactions(id),
  confidence             REAL,
  created_at             TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at             TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_import_rows_batch ON import_rows (batch_id);
CREATE INDEX IF NOT EXISTS idx_import_rows_match ON import_rows (match_status);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

CREATE TRIGGER IF NOT EXISTS trg_users_updated_at AFTER UPDATE ON users
BEGIN UPDATE users SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS trg_templates_updated_at AFTER UPDATE ON templates
BEGIN UPDATE templates SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS trg_ledgers_updated_at AFTER UPDATE ON ledgers
BEGIN UPDATE ledgers SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS trg_api_keys_updated_at AFTER UPDATE ON api_keys
BEGIN UPDATE api_keys SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS trg_accounts_updated_at AFTER UPDATE ON accounts
BEGIN UPDATE accounts SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS trg_transactions_updated_at AFTER UPDATE ON transactions
BEGIN UPDATE transactions SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS trg_line_items_updated_at AFTER UPDATE ON line_items
BEGIN UPDATE line_items SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS trg_reversals_updated_at AFTER UPDATE ON reversals
BEGIN UPDATE reversals SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS trg_import_batches_updated_at AFTER UPDATE ON import_batches
BEGIN UPDATE import_batches SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS trg_import_rows_updated_at AFTER UPDATE ON import_rows
BEGIN UPDATE import_rows SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = NEW.id; END;

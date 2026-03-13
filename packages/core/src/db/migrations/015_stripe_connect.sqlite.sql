-- 015: Stripe Connect — native Stripe integration for granular revenue tracking.
-- Stores OAuth connections and deduplication events.

CREATE TABLE IF NOT EXISTS stripe_connections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ledger_id TEXT NOT NULL REFERENCES ledgers(id),
  stripe_account_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  stripe_publishable_key TEXT,
  webhook_secret TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'disconnected', 'error')),
  last_synced_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_stripe_conn_user_account
  ON stripe_connections(user_id, stripe_account_id);

CREATE TABLE IF NOT EXISTS stripe_events (
  id TEXT PRIMARY KEY,
  connection_id TEXT NOT NULL REFERENCES stripe_connections(id),
  stripe_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  processed_at TEXT NOT NULL DEFAULT (datetime('now')),
  ledger_transaction_id TEXT REFERENCES transactions(id),
  metadata TEXT,
  UNIQUE(connection_id, stripe_event_id)
);

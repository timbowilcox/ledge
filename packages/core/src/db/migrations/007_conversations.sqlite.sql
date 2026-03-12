-- ---------------------------------------------------------------------------
-- 007 — AI Financial Assistant conversations (SQLite)
--
-- Stores chat conversations between users and the AI assistant, scoped to
-- a user + ledger pair. Messages stored as JSON text.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS conversations (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ledger_id   TEXT NOT NULL REFERENCES ledgers(id) ON DELETE CASCADE,
  title       TEXT,
  messages    TEXT NOT NULL DEFAULT '[]',
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_conversations_user_ledger
  ON conversations(user_id, ledger_id);

-- Ledge: Migration 002 — Add 'updated' to audit_entries action CHECK constraint
-- SQLite cannot ALTER CHECK constraints, so we recreate the table.

CREATE TABLE IF NOT EXISTS audit_entries_new (
  id           TEXT PRIMARY KEY,
  ledger_id    TEXT NOT NULL REFERENCES ledgers(id),
  entity_type  TEXT NOT NULL,
  entity_id    TEXT NOT NULL,
  action       TEXT NOT NULL CHECK (action IN ('created', 'reversed', 'archived', 'updated')),
  actor_type   TEXT NOT NULL CHECK (actor_type IN ('user', 'agent', 'system')),
  actor_id     TEXT NOT NULL,
  evidence_ref TEXT,
  snapshot     TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

INSERT INTO audit_entries_new SELECT * FROM audit_entries;
DROP TABLE audit_entries;
ALTER TABLE audit_entries_new RENAME TO audit_entries;

CREATE INDEX IF NOT EXISTS idx_audit_ledger ON audit_entries (ledger_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_entries (entity_type, entity_id);

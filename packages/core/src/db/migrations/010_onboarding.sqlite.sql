-- Migration 010: Onboarding state and checklist tables (SQLite)

CREATE TABLE IF NOT EXISTS onboarding_state (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_type TEXT,
  business_age TEXT,
  payment_processor TEXT,
  bank_situation TEXT,
  business_structure TEXT,
  country TEXT,
  currency TEXT,
  completed_steps TEXT NOT NULL DEFAULT '[]',
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS onboarding_checklist (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  dismissed INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, item)
);

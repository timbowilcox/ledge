-- ---------------------------------------------------------------------------
-- 008: Classification Rules Engine (SQLite)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS classification_rules (
  id                TEXT PRIMARY KEY,
  ledger_id         TEXT NOT NULL REFERENCES ledgers(id) ON DELETE CASCADE,
  priority          INTEGER NOT NULL DEFAULT 100,
  rule_type         TEXT NOT NULL CHECK (rule_type IN ('exact', 'contains', 'regex', 'amount_range')),
  field             TEXT NOT NULL CHECK (field IN ('description', 'merchant_name', 'category')),
  pattern           TEXT NOT NULL,
  target_account_id TEXT NOT NULL REFERENCES accounts(id),
  is_personal       INTEGER NOT NULL DEFAULT 0,
  confidence        REAL NOT NULL DEFAULT 1.0,
  auto_generated    INTEGER NOT NULL DEFAULT 0,
  hit_count         INTEGER NOT NULL DEFAULT 0,
  last_hit_at       TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_classification_rules_ledger
  ON classification_rules (ledger_id, priority);

CREATE INDEX IF NOT EXISTS idx_classification_rules_lookup
  ON classification_rules (ledger_id, rule_type, field);

CREATE TABLE IF NOT EXISTS merchant_aliases (
  id              TEXT PRIMARY KEY,
  canonical_name  TEXT NOT NULL,
  alias           TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(alias)
);

CREATE INDEX IF NOT EXISTS idx_merchant_aliases_alias
  ON merchant_aliases (alias);

CREATE INDEX IF NOT EXISTS idx_merchant_aliases_canonical
  ON merchant_aliases (canonical_name);

-- SQLite ALTER TABLE only supports adding one column at a time
ALTER TABLE bank_transactions ADD COLUMN is_personal INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bank_transactions ADD COLUMN suggested_account_id TEXT REFERENCES accounts(id);

-- Seed merchant aliases for common SaaS vendors
INSERT OR IGNORE INTO merchant_aliases (id, canonical_name, alias, created_at) VALUES
  -- AWS
  (lower(hex(randomblob(16))), 'AWS', 'AMAZON WEB SERVICES', datetime('now')),
  (lower(hex(randomblob(16))), 'AWS', 'AMZN WEB SVCS', datetime('now')),
  (lower(hex(randomblob(16))), 'AWS', 'AWS', datetime('now')),
  (lower(hex(randomblob(16))), 'AWS', 'AMZ*WEB', datetime('now')),
  -- Stripe
  (lower(hex(randomblob(16))), 'STRIPE', 'STRIPE', datetime('now')),
  (lower(hex(randomblob(16))), 'STRIPE', 'STRIPE PAYMENTS', datetime('now')),
  (lower(hex(randomblob(16))), 'STRIPE', 'STRIPE TRANSFER', datetime('now')),
  -- Vercel
  (lower(hex(randomblob(16))), 'VERCEL', 'VERCEL INC', datetime('now')),
  (lower(hex(randomblob(16))), 'VERCEL', 'VERCEL', datetime('now')),
  -- GitHub
  (lower(hex(randomblob(16))), 'GITHUB', 'GITHUB', datetime('now')),
  (lower(hex(randomblob(16))), 'GITHUB', 'GITHUB.COM', datetime('now')),
  (lower(hex(randomblob(16))), 'GITHUB', 'GH*GITHUB', datetime('now')),
  -- Google Cloud
  (lower(hex(randomblob(16))), 'GOOGLE CLOUD', 'GOOGLE*CLOUD', datetime('now')),
  (lower(hex(randomblob(16))), 'GOOGLE CLOUD', 'GOOGLE CLOUD', datetime('now')),
  (lower(hex(randomblob(16))), 'GOOGLE CLOUD', 'GCP', datetime('now')),
  -- Hetzner
  (lower(hex(randomblob(16))), 'HETZNER', 'HETZNER', datetime('now')),
  (lower(hex(randomblob(16))), 'HETZNER', 'HETZNER ONLINE', datetime('now')),
  (lower(hex(randomblob(16))), 'HETZNER', 'HETZNER CLOUD', datetime('now')),
  -- DigitalOcean
  (lower(hex(randomblob(16))), 'DIGITALOCEAN', 'DIGITALOCEAN', datetime('now')),
  (lower(hex(randomblob(16))), 'DIGITALOCEAN', 'DIGITALOCEAN.COM', datetime('now')),
  -- Notion
  (lower(hex(randomblob(16))), 'NOTION', 'NOTION.SO', datetime('now')),
  (lower(hex(randomblob(16))), 'NOTION', 'NOTION LABS', datetime('now')),
  -- Figma
  (lower(hex(randomblob(16))), 'FIGMA', 'FIGMA', datetime('now')),
  (lower(hex(randomblob(16))), 'FIGMA', 'FIGMA INC', datetime('now')),
  -- Slack
  (lower(hex(randomblob(16))), 'SLACK', 'SLACK TECHNOLOGIES', datetime('now')),
  (lower(hex(randomblob(16))), 'SLACK', 'SLACK.COM', datetime('now')),
  -- Zoom
  (lower(hex(randomblob(16))), 'ZOOM', 'ZOOM.US', datetime('now')),
  (lower(hex(randomblob(16))), 'ZOOM', 'ZOOM VIDEO', datetime('now')),
  -- Linear
  (lower(hex(randomblob(16))), 'LINEAR', 'LINEAR', datetime('now')),
  (lower(hex(randomblob(16))), 'LINEAR', 'LINEAR.APP', datetime('now')),
  -- Render
  (lower(hex(randomblob(16))), 'RENDER', 'RENDER', datetime('now')),
  (lower(hex(randomblob(16))), 'RENDER', 'RENDER.COM', datetime('now')),
  -- Supabase
  (lower(hex(randomblob(16))), 'SUPABASE', 'SUPABASE', datetime('now')),
  (lower(hex(randomblob(16))), 'SUPABASE', 'SUPABASE INC', datetime('now')),
  -- Railway
  (lower(hex(randomblob(16))), 'RAILWAY', 'RAILWAY', datetime('now')),
  (lower(hex(randomblob(16))), 'RAILWAY', 'RAILWAY.APP', datetime('now')),
  -- Netlify
  (lower(hex(randomblob(16))), 'NETLIFY', 'NETLIFY', datetime('now')),
  (lower(hex(randomblob(16))), 'NETLIFY', 'NETLIFY.COM', datetime('now')),
  -- Cloudflare
  (lower(hex(randomblob(16))), 'CLOUDFLARE', 'CLOUDFLARE', datetime('now')),
  (lower(hex(randomblob(16))), 'CLOUDFLARE', 'CLOUDFLARE INC', datetime('now')),
  -- Netflix
  (lower(hex(randomblob(16))), 'NETFLIX', 'NETFLIX.COM', datetime('now')),
  (lower(hex(randomblob(16))), 'NETFLIX', 'NETFLIX', datetime('now')),
  -- Spotify
  (lower(hex(randomblob(16))), 'SPOTIFY', 'SPOTIFY', datetime('now')),
  (lower(hex(randomblob(16))), 'SPOTIFY', 'SPOTIFY AB', datetime('now'));

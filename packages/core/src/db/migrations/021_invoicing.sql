-- ---------------------------------------------------------------------------
-- 021: Invoicing — Accounts Receivable
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS invoices (
  id                      TEXT PRIMARY KEY,
  ledger_id               TEXT NOT NULL REFERENCES ledgers(id),
  invoice_number          TEXT NOT NULL,

  -- Customer
  customer_name           TEXT NOT NULL,
  customer_email          TEXT,
  customer_address        TEXT,

  -- Dates
  issue_date              TEXT NOT NULL,
  due_date                TEXT NOT NULL,

  -- Amounts (all in cents, ledger base currency)
  subtotal                BIGINT NOT NULL,
  tax_amount              BIGINT NOT NULL DEFAULT 0,
  total                   BIGINT NOT NULL,
  amount_paid             BIGINT NOT NULL DEFAULT 0,
  amount_due              BIGINT NOT NULL,
  currency                TEXT NOT NULL,

  -- Tax
  tax_rate                DECIMAL(5,4),
  tax_label               TEXT,
  tax_inclusive            BOOLEAN NOT NULL DEFAULT FALSE,

  -- Status
  status                  TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN (
      'draft', 'sent', 'viewed', 'paid',
      'partially_paid', 'overdue', 'void'
    )),

  -- Payment tracking
  paid_date               TEXT,
  -- NOTE: payment_transaction_id is deprecated.
  -- Use invoice_payments.transaction_id instead.
  -- Column retained for backwards compatibility.
  payment_transaction_id  TEXT REFERENCES transactions(id),

  -- AR journal entry (posted when invoice is sent/approved)
  ar_transaction_id       TEXT REFERENCES transactions(id),

  -- Content
  notes                   TEXT,
  footer                  TEXT,

  -- Accounts
  revenue_account_id      TEXT REFERENCES accounts(id),
  ar_account_id           TEXT REFERENCES accounts(id),
  tax_account_id          TEXT REFERENCES accounts(id),

  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(ledger_id, invoice_number)
);

CREATE TABLE IF NOT EXISTS invoice_line_items (
  id                TEXT PRIMARY KEY,
  invoice_id        TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,

  description       TEXT NOT NULL,
  quantity          DECIMAL(10,4) NOT NULL DEFAULT 1,
  unit_price        BIGINT NOT NULL,
  amount            BIGINT NOT NULL,

  -- Per-line tax override (optional — defaults to invoice-level tax)
  tax_rate          DECIMAL(5,4),
  tax_amount        BIGINT NOT NULL DEFAULT 0,

  -- Optional account override per line
  account_id        TEXT REFERENCES accounts(id),

  sort_order        INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoice_payments (
  id                    TEXT PRIMARY KEY,
  invoice_id            TEXT NOT NULL REFERENCES invoices(id),

  amount                BIGINT NOT NULL,
  payment_date          TEXT NOT NULL,
  payment_method        TEXT,
  reference             TEXT,

  transaction_id        TEXT REFERENCES transactions(id),
  bank_transaction_id   TEXT,

  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_invoices_ledger
  ON invoices(ledger_id);

CREATE INDEX IF NOT EXISTS idx_invoices_status
  ON invoices(ledger_id, status);

CREATE INDEX IF NOT EXISTS idx_invoices_due
  ON invoices(due_date)
  WHERE status NOT IN ('paid', 'void');

CREATE INDEX IF NOT EXISTS idx_invoices_customer
  ON invoices(ledger_id, customer_name);

CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice
  ON invoice_line_items(invoice_id);

CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice
  ON invoice_payments(invoice_id);

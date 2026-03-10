# SDK Guide

How to install, initialise, and use the `@ledge/sdk` TypeScript client.

## Install

```bash
npm install @ledge/sdk
```

## Initialise

```typescript
import { Ledge } from "@ledge/sdk";

const ledge = new Ledge({
  apiKey: "ldg_live_...",             // your API key
  adminSecret: "sk_admin_...",        // optional — only for admin operations
  baseUrl: "https://api.getledge.ai", // optional — defaults to production
});
```

### Configuration

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `apiKey` | `string` | Yes | API key (`ldg_live_...` or `ldg_test_...`) |
| `adminSecret` | `string` | No | Admin secret for bootstrap operations (ledger creation, API key management) |
| `baseUrl` | `string` | No | API base URL (defaults to production) |
| `fetch` | `typeof fetch` | No | Custom fetch function for edge runtimes, testing, or middleware |

## Modules

The SDK is organised into modules that mirror the REST API:

| Module | Description |
|--------|-------------|
| `ledge.ledgers` | Create and retrieve ledgers |
| `ledge.accounts` | Create, list, and retrieve accounts |
| `ledge.transactions` | Post, list, retrieve, and reverse transactions |
| `ledge.reports` | Income statement, balance sheet, cash flow |
| `ledge.audit` | List audit trail entries |
| `ledge.imports` | Upload CSV/OFX files, review matches, confirm |
| `ledge.templates` | List, recommend, and apply chart-of-accounts |
| `ledge.apiKeys` | Create, list, and revoke API keys |

---

## ledge.ledgers

Requires `adminSecret` for creation.

### create(input)

Create a new ledger.

```typescript
const ledger = await ledge.ledgers.create({
  name: "Acme Corp",
  ownerId: "usr_...",
  currency: "USD",
  accountingBasis: "accrual",
});

console.log(ledger.id);       // UUIDv7
console.log(ledger.currency); // "USD"
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | Ledger display name |
| `ownerId` | `string` | Yes | Owner user ID |
| `currency` | `string` | Yes | ISO currency code (e.g. `USD`, `EUR`) |
| `accountingBasis` | `"accrual" \| "cash"` | Yes | Accounting basis |

### get(ledgerId)

Retrieve a ledger by ID.

```typescript
const ledger = await ledge.ledgers.get("ldg_abc123");
```

---

## ledge.accounts

### create(ledgerId, input)

Create a new account in the chart of accounts.

```typescript
const account = await ledge.accounts.create("ldg_abc123", {
  code: "1000",
  name: "Cash",
  type: "asset",
});

console.log(account.id);   // UUIDv7
console.log(account.code); // "1000"
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `code` | `string` | Yes | Account code (e.g. `1000`, `4100`) |
| `name` | `string` | Yes | Display name |
| `type` | `"asset" \| "liability" \| "equity" \| "revenue" \| "expense"` | Yes | Account type |
| `parentCode` | `string` | No | Parent account code for sub-accounts |
| `metadata` | `Record<string, unknown>` | No | Additional metadata |

### list(ledgerId)

List all accounts with current balances.

```typescript
const accounts = await ledge.accounts.list("ldg_abc123");

for (const acct of accounts.data) {
  console.log(acct.code, acct.name, acct.balance);
}
```

### get(ledgerId, accountId)

Retrieve a single account.

```typescript
const acct = await ledge.accounts.get("ldg_abc123", "acc_...");
console.log(acct.balance); // integer cents
```

---

## ledge.transactions

### post(ledgerId, input)

Post a balanced double-entry transaction. Debits must equal credits.

```typescript
const txn = await ledge.transactions.post("ldg_abc123", {
  date: "2025-03-10",
  memo: "March subscription revenue",
  lines: [
    { accountCode: "1000", amount: 9900, direction: "debit" },  // Cash +$99.00
    { accountCode: "4000", amount: 9900, direction: "credit" }, // Revenue +$99.00
  ],
});

console.log(txn.id);     // UUIDv7
console.log(txn.status); // "posted"
```

**Parameters (PostTransactionParams):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `date` | `string` | Yes | Transaction date (ISO 8601) |
| `memo` | `string` | Yes | Transaction description |
| `lines` | `LineInput[]` | Yes | Line items (min 2, must balance) |
| `effectiveDate` | `string` | No | Effective date if different from `date` |
| `idempotencyKey` | `string` | No | Unique key to prevent duplicate posts |
| `metadata` | `Record<string, unknown>` | No | Additional metadata |

**LineInput:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `accountCode` | `string` | Yes | Account code |
| `amount` | `number` | Yes | Amount in smallest currency unit (cents) |
| `direction` | `"debit" \| "credit"` | Yes | Debit or credit |
| `memo` | `string` | No | Line item memo |

### list(ledgerId, options?)

List transactions with cursor-based pagination.

```typescript
let cursor: string | undefined;
do {
  const page = await ledge.transactions.list("ldg_abc123", {
    limit: 50,
    cursor,
  });

  for (const txn of page.data) {
    console.log(txn.memo, txn.date);
  }

  cursor = page.nextCursor ?? undefined;
} while (cursor);
```

**Options (ListOptions):**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `cursor` | `string` | — | Pagination cursor from previous response |
| `limit` | `number` | 50 | Results per page (1–200) |

### get(ledgerId, transactionId)

Retrieve a single transaction with all line items.

```typescript
const txn = await ledge.transactions.get("ldg_abc123", "txn_...");

for (const line of txn.lines) {
  console.log(line.accountCode, line.direction, line.amount);
}
```

### reverse(ledgerId, transactionId, reason)

Reverse a posted transaction by creating offsetting entries.

```typescript
const reversal = await ledge.transactions.reverse(
  "ldg_abc123",
  "txn_...",
  "Customer refund",
);

console.log(reversal.status); // "posted"
// Original transaction status becomes "reversed"
```

---

## ledge.reports

### incomeStatement(ledgerId, startDate, endDate)

Generate an Income Statement (P&L) for a date range.

```typescript
const pnl = await ledge.reports.incomeStatement(
  "ldg_abc123",
  "2025-01-01",
  "2025-03-31",
);

console.log(pnl.statementType);       // "pnl"
console.log(pnl.totals.netIncome);    // integer cents
console.log(pnl.plainLanguageSummary); // human-readable summary

for (const section of pnl.sections) {
  console.log(section.title, section.total);
  for (const line of section.lines) {
    console.log("  ", line.accountCode, line.accountName, line.amount);
  }
}
```

### balanceSheet(ledgerId, asOfDate)

Generate a Balance Sheet as of a specific date.

```typescript
const bs = await ledge.reports.balanceSheet("ldg_abc123", "2025-03-31");

console.log(bs.totals.totalAssets);
console.log(bs.totals.totalLiabilities);
console.log(bs.totals.totalEquity);
```

### cashFlow(ledgerId, startDate, endDate)

Generate a Cash Flow Statement for a date range.

```typescript
const cf = await ledge.reports.cashFlow("ldg_abc123", "2025-01-01", "2025-03-31");

console.log(cf.totals.netCashChange);
```

---

## ledge.audit

### list(ledgerId, options?)

List audit trail entries for a ledger.

```typescript
const audit = await ledge.audit.list("ldg_abc123", { limit: 100 });

for (const entry of audit.data) {
  console.log(entry.action, entry.entityType, entry.entityId, entry.timestamp);
}
```

---

## ledge.imports

### upload(ledgerId, input)

Upload a CSV or OFX bank statement. Parses the file and runs the matching engine.

```typescript
import { readFileSync } from "node:fs";

const csv = readFileSync("bank-march.csv", "utf-8");
const result = await ledge.imports.upload("ldg_abc123", {
  fileContent: csv,
  fileType: "csv",
  filename: "bank-march.csv",
});

console.log(result.batch.rowCount);      // number of parsed rows
console.log(result.batch.matchedCount);  // auto-matched rows
console.log(result.batch.unmatchedCount);

for (const row of result.rows) {
  console.log(row.payee, row.amount, row.matchStatus, row.confidence);
}
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `fileContent` | `string` | Yes | File content as a string |
| `fileType` | `"csv" \| "ofx"` | Yes | File format |
| `filename` | `string` | No | Original filename for reference |

### list(ledgerId, options?)

List import batches for a ledger.

```typescript
const imports = await ledge.imports.list("ldg_abc123");

for (const batch of imports.data) {
  console.log(batch.id, batch.status, batch.rowCount);
}
```

### get(batchId)

Get details of an import batch including all rows.

```typescript
const batch = await ledge.imports.get("imp_...");
```

### confirmMatches(batchId, actions)

Confirm, reject, or override suggested transaction matches.

```typescript
await ledge.imports.confirmMatches("imp_...", [
  { rowId: "row_1", action: "confirm" },
  { rowId: "row_2", action: "reject" },
  { rowId: "row_3", action: "override", overrideTransactionId: "txn_..." },
]);
```

**Action types:**

| Action | Description |
|--------|-------------|
| `confirm` | Accept the suggested match |
| `reject` | Reject the suggested match |
| `override` | Override with a specific transaction ID |

---

## ledge.templates

### list()

List all available templates.

```typescript
const templates = await ledge.templates.list();

for (const t of templates) {
  console.log(t.slug, t.name, t.description);
}
```

### get(idOrSlug)

Get a single template with its full chart of accounts.

```typescript
const saas = await ledge.templates.get("saas");
console.log(saas.accounts.length); // 18
```

### recommend(context)

Get AI-powered template recommendations based on business context.

```typescript
const recs = await ledge.templates.recommend({
  industry: "software",
  businessModel: "subscription",
});

console.log(recs[0].template.name);  // "SaaS"
console.log(recs[0].reason);         // explanation of why
console.log(recs[0].score);          // confidence score
```

### apply(ledgerId, templateSlug)

Apply a template to a ledger (creates all accounts). Requires `adminSecret`.

```typescript
const applied = await ledge.templates.apply("ldg_abc123", "saas");
console.log(applied.count); // number of accounts created
```

---

## ledge.apiKeys

All API key operations require `adminSecret`.

### create(input)

Create a new API key for a ledger.

```typescript
const key = await ledge.apiKeys.create({
  userId: "usr_...",
  ledgerId: "ldg_abc123",
  name: "production",
});

console.log(key.rawKey); // only shown once — store securely
```

### list(ledgerId)

List API keys for a ledger (keys are masked).

```typescript
const keys = await ledge.apiKeys.list("ldg_abc123");

for (const k of keys) {
  console.log(k.name, k.prefix); // prefix is e.g. "ldg_live_abc..."
}
```

### revoke(keyId)

Revoke an API key.

```typescript
await ledge.apiKeys.revoke("key_...");
```

---

## Error Handling

Non-2xx responses throw a `LedgeApiError` with structured fields.

```typescript
import { LedgeApiError } from "@ledge/sdk";

try {
  await ledge.transactions.post("ldg_abc123", { /* ... */ });
} catch (e) {
  if (e instanceof LedgeApiError) {
    console.log(e.status);    // HTTP status code (e.g. 400)
    console.log(e.code);      // error code (e.g. "UNBALANCED_TRANSACTION")
    console.log(e.message);   // human-readable message
    console.log(e.details);   // array of detail objects with suggestion field
    console.log(e.requestId); // request ID for support tickets
  }
}
```

Every error response includes a `details[].suggestion` field with a recommended next step.

---

## Types

All domain types are re-exported from `@ledge/sdk` — no need to install `@ledge/core`:

```typescript
import type {
  Ledger,
  Account,
  AccountWithBalance,
  TransactionWithLines,
  LineItem,
  StatementResponse,
  ImportBatch,
  ImportRow,
  Template,
  AuditEntry,
  PaginatedResult,
} from "@ledge/sdk";
```

---

## Custom Fetch

Pass a custom `fetch` for edge runtimes, testing, or middleware:

```typescript
const ledge = new Ledge({
  apiKey: "ldg_live_...",
  fetch: myCustomFetch,
});
```

---

## Full Example

End-to-end workflow: create a ledger, apply a template, post transactions, generate reports.

```typescript
import { Ledge } from "@ledge/sdk";

// Admin client for setup
const admin = new Ledge({
  apiKey: "ldg_live_...",
  adminSecret: process.env.LEDGE_ADMIN_SECRET,
});

// 1. Create a ledger
const ledger = await admin.ledgers.create({
  name: "My SaaS Business",
  ownerId: "usr_...",
  currency: "USD",
  accountingBasis: "accrual",
});

// 2. Apply a template
await admin.templates.apply(ledger.id, "saas");

// 3. Create an API key
const key = await admin.apiKeys.create({
  userId: "usr_...",
  ledgerId: ledger.id,
  name: "app",
});

// 4. Switch to a regular client with the new key
const ledge = new Ledge({ apiKey: key.rawKey });

// 5. Post a transaction
await ledge.transactions.post(ledger.id, {
  date: "2025-03-10",
  memo: "Monthly subscription — Acme Inc",
  lines: [
    { accountCode: "1000", amount: 9900, direction: "debit" },
    { accountCode: "4000", amount: 9900, direction: "credit" },
  ],
  idempotencyKey: "stripe_inv_abc123",
});

// 6. Generate a P&L
const pnl = await ledge.reports.incomeStatement(
  ledger.id,
  "2025-03-01",
  "2025-03-31",
);

console.log(pnl.plainLanguageSummary);
```
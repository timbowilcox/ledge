# MCP Server Guide

How to connect the Ledge MCP server to Claude Code, Cursor, and other MCP-compatible clients.

## Overview

The Ledge MCP server exposes a full double-entry accounting engine as MCP tools, resources, and prompts. It runs in-process with an embedded SQLite database and communicates via stdio transport.

- **12 tools** for ledger setup, transactions, accounts, statements, imports, and usage
- **4 resources** for read-only views into ledger data
- **3 prompt templates** for guided accounting workflows

## Installation

```bash
npm install @ledge/mcp
```

## Connect to Claude Code

Add the Ledge MCP server to your Claude Code configuration:

```json
{
  "mcpServers": {
    "ledge": {
      "command": "npx",
      "args": ["@ledge/mcp"]
    }
  }
}
```

Place this in `.claude/settings.json` (project-level) or `~/.claude/settings.json` (global).

## Connect to Cursor

Add to your Cursor MCP configuration (`.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "ledge": {
      "command": "npx",
      "args": ["@ledge/mcp"]
    }
  }
}
```

## Connect to Any MCP Client

The server uses **stdio transport**. Launch with:

```bash
npx @ledge/mcp
```

The server boots an in-memory SQLite database and registers all tools, resources, and prompts automatically.

---

## Tools

### 1. setup_ledger

Accept a natural language business description and return a fully configured ledger, or return gap-filling questions if context is insufficient.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `description` | `string` | Yes | Describe the business in plain English |

**Behavior:**

- **High confidence** (score >= 6): Auto-provisions a ledger with the best matching template. Returns the ledger, template, and accounts.
- **Partial match** (score > 0): Returns the top 3 recommendations with gap-filling questions. Call `complete_setup` to finalize.
- **No match**: Returns all available templates and asks for more detail.

**Example:**

```
Tool: setup_ledger
Input: { "description": "I run a SaaS company selling project management software with monthly subscriptions" }

Response: {
  "status": "complete",
  "ledger": { "id": "ldg_...", "name": "SaaS Ledger" },
  "template": { "slug": "saas", "name": "SaaS" },
  "accounts": [...],  // 18 pre-configured accounts
  "confidence": 9
}
```

---

### 2. complete_setup

Finalize ledger setup with a specific template after reviewing recommendations.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `templateSlug` | `string` | Yes | Template slug to apply (e.g. `saas`, `ecommerce`) |
| `name` | `string` | No | Ledger display name |
| `currency` | `string` | No | ISO currency code (default `USD`) |
| `description` | `string` | No | Business description |

**Example:**

```
Tool: complete_setup
Input: { "templateSlug": "marketplace", "name": "My Marketplace" }
```

---

### 3. post_transaction

Post a balanced double-entry transaction to a ledger. Debits must equal credits.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `ledgerId` | `string` | Yes | Ledger ID |
| `date` | `string` | Yes | Transaction date (ISO 8601, e.g. `2024-03-15`) |
| `memo` | `string` | Yes | Transaction description |
| `lines` | `array` | Yes | Line items (min 2, must balance) |
| `effectiveDate` | `string` | No | Effective date if different from `date` |
| `idempotencyKey` | `string` | No | Unique key to prevent duplicate posts |
| `metadata` | `object` | No | Additional metadata (JSON) |

**Line item fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `accountCode` | `string` | Yes | Account code (e.g. `1000`) |
| `amount` | `integer` | Yes | Amount in smallest currency unit (cents) |
| `direction` | `"debit" \| "credit"` | Yes | Debit or credit |
| `memo` | `string` | No | Line item memo |

**Example:**

```
Tool: post_transaction
Input: {
  "ledgerId": "ldg_...",
  "date": "2025-03-10",
  "memo": "Monthly subscription revenue",
  "lines": [
    { "accountCode": "1000", "amount": 9900, "direction": "debit" },
    { "accountCode": "4000", "amount": 9900, "direction": "credit" }
  ]
}
```

---

### 4. reverse_transaction

Reverse a posted transaction by creating offsetting entries. The original transaction status becomes `reversed`.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `transactionId` | `string` | Yes | ID of the transaction to reverse |
| `reason` | `string` | Yes | Reason for reversal |

**Example:**

```
Tool: reverse_transaction
Input: { "transactionId": "txn_...", "reason": "Customer refund" }
```

---

### 5. search_transactions

List transactions for a ledger with cursor-based pagination.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `ledgerId` | `string` | Yes | Ledger ID |
| `cursor` | `string` | No | Pagination cursor from previous response |
| `limit` | `integer` | No | Results per page (default 50, max 200) |

**Example:**

```
Tool: search_transactions
Input: { "ledgerId": "ldg_...", "limit": 20 }
```

---

### 6. list_accounts

List all accounts for a ledger with their current balances.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `ledgerId` | `string` | Yes | Ledger ID |

**Example:**

```
Tool: list_accounts
Input: { "ledgerId": "ldg_..." }
```

---

### 7. create_account

Create a new account in the chart of accounts.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `ledgerId` | `string` | Yes | Ledger ID |
| `code` | `string` | Yes | Account code (e.g. `1000`, `4100`) |
| `name` | `string` | Yes | Account display name |
| `type` | `string` | Yes | `asset`, `liability`, `equity`, `revenue`, or `expense` |
| `parentCode` | `string` | No | Parent account code for sub-accounts |
| `metadata` | `object` | No | Additional metadata (JSON) |

**Example:**

```
Tool: create_account
Input: {
  "ledgerId": "ldg_...",
  "code": "6100",
  "name": "Travel Expenses",
  "type": "expense"
}
```

---

### 8. get_statement

Generate a financial statement: income statement (P&L), balance sheet, or cash flow.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `ledgerId` | `string` | Yes | Ledger ID |
| `type` | `string` | Yes | `pnl`, `balance_sheet`, or `cash_flow` |
| `startDate` | `string` | Conditional | Required for `pnl` and `cash_flow` |
| `endDate` | `string` | Conditional | Required for `pnl` and `cash_flow` |
| `asOfDate` | `string` | Conditional | Required for `balance_sheet` |

**Examples:**

```
Tool: get_statement
Input: {
  "ledgerId": "ldg_...",
  "type": "pnl",
  "startDate": "2025-01-01",
  "endDate": "2025-03-31"
}
```

```
Tool: get_statement
Input: {
  "ledgerId": "ldg_...",
  "type": "balance_sheet",
  "asOfDate": "2025-03-31"
}
```

---

### 9. import_file

Import a CSV or OFX bank statement. Parses the file, normalizes dates and amounts, and runs the reconciliation engine to match rows against existing transactions.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `ledgerId` | `string` | Yes | Ledger ID to import into |
| `format` | `string` | Yes | `csv` or `ofx` |
| `content` | `string` | Yes | File content as a string |
| `filename` | `string` | No | Original filename for reference |

**Example:**

```
Tool: import_file
Input: {
  "ledgerId": "ldg_...",
  "format": "csv",
  "content": "Date,Description,Amount\n2025-03-01,Stripe Payment,99.00\n...",
  "filename": "bank-march.csv"
}
```

---

### 10. confirm_matches

Confirm, reject, or override suggested transaction matches from an import batch.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `batchId` | `string` | Yes | Import batch ID |
| `actions` | `array` | Yes | Match decisions for import rows |

**Action fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `rowId` | `string` | Yes | Import row ID |
| `action` | `string` | Yes | `confirm`, `reject`, or `override` |
| `overrideTransactionId` | `string` | Conditional | Required for `override` action |

**Example:**

```
Tool: confirm_matches
Input: {
  "batchId": "imp_...",
  "actions": [
    { "rowId": "row_1", "action": "confirm" },
    { "rowId": "row_2", "action": "reject" },
    { "rowId": "row_3", "action": "override", "overrideTransactionId": "txn_..." }
  ]
}
```

---

### 11. get_import_batch

Get details of an import batch including all rows with their match status and confidence scores.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `batchId` | `string` | Yes | Import batch ID |

**Example:**

```
Tool: get_import_batch
Input: { "batchId": "imp_..." }
```

---

### 12. get_usage

Get usage statistics for a ledger: account count, transaction count, line item count.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `ledgerId` | `string` | Yes | Ledger ID |

**Example:**

```
Tool: get_usage
Input: { "ledgerId": "ldg_..." }

Response: {
  "ledgerId": "ldg_...",
  "accounts": 18,
  "transactions": 42,
  "lineItems": 84
}
```

---

## Resources

Resources are read-only views into ledger data, accessible via URI templates.

### 1. chart-of-accounts

| Property | Value |
|----------|-------|
| **URI** | `ledger://{id}/chart-of-accounts` |
| **Description** | Full chart of accounts with current balances |

Returns all accounts for the specified ledger with their codes, names, types, and balances.

### 2. pnl

| Property | Value |
|----------|-------|
| **URI** | `ledger://{id}/pnl{?start,end}` |
| **Description** | Income Statement (P&L) for a date range |

**Required parameters:** `start` (period start date), `end` (period end date).

### 3. balance-sheet

| Property | Value |
|----------|-------|
| **URI** | `ledger://{id}/balance-sheet{?as_of}` |
| **Description** | Balance Sheet as of a specific date |

**Required parameter:** `as_of` (point-in-time date).

### 4. recent-transactions

| Property | Value |
|----------|-------|
| **URI** | `ledger://{id}/recent-transactions{?limit}` |
| **Description** | Recent transactions for a ledger |

**Optional parameter:** `limit` (number of transactions, default 20).

---

## Prompt Templates

Prompt templates are reusable accounting workflows that guide the AI assistant through multi-step processes.

### 1. monthly-close

Step-by-step month-end close workflow for a ledger.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `ledgerId` | `string` | Ledger ID |
| `month` | `string` | Month to close (YYYY-MM format, e.g. `2024-03`) |

**Workflow steps:**

1. Review unposted items using `search_transactions`
2. Verify completeness of revenue, expenses, and accruals
3. Generate trial balance using `list_accounts`
4. Generate financial statements (P&L, Balance Sheet, Cash Flow)
5. Review for anomalies
6. Reconcile bank balances
7. Report findings

---

### 2. reconcile-bank

Guide for reconciling a bank account against a statement balance.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `ledgerId` | `string` | Ledger ID |
| `accountCode` | `string` | Bank account code (e.g. `1000`) |
| `statementBalance` | `string` | Bank statement ending balance in cents (e.g. `150000` for $1,500.00) |

**Workflow steps:**

1. Get ledger balance for the account
2. Compare with statement balance
3. If balanced, report reconciled
4. If unbalanced, investigate (outstanding checks, deposits in transit, missing entries)
5. Post adjustments (bank fees, interest)
6. Verify and report

---

### 3. explain-statement

Generate a financial statement and explain it in plain English.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `ledgerId` | `string` | Ledger ID |
| `statementType` | `string` | `pnl`, `balance_sheet`, or `cash_flow` |
| `startDate` | `string` | Period start date (for `pnl` and `cash_flow`) |
| `endDate` | `string` | Period end date (for `pnl` and `cash_flow`) |
| `asOfDate` | `string` | Point-in-time date (for `balance_sheet`) |

**Workflow steps:**

1. Generate the statement
2. Read the plain language summary
3. Explain each section in simple terms
4. Highlight key metrics
5. Flag concerns
6. Provide actionable recommendations

---

## Typical Workflow

A common conversation flow with the Ledge MCP server:

1. **Setup**: "I run a SaaS company" → `setup_ledger` auto-provisions with the SaaS template
2. **Record**: "We got paid $99 from Acme" → `post_transaction` with debit Cash, credit Revenue
3. **Review**: "Show me the P&L for March" → `get_statement` with type `pnl`
4. **Import**: "Here is our bank statement" → `import_file` → review matches → `confirm_matches`
5. **Close**: Use the `monthly-close` prompt template for a guided month-end process
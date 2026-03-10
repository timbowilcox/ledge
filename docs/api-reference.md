# Ledge API Reference

Complete reference for the Ledge REST API. Base URL: `http://localhost:3001`

---

## Table of Contents

- [Authentication](#authentication)
- [Response Format](#response-format)
- [Pagination](#pagination)
- [Error Codes](#error-codes)
- [Endpoints](#endpoints)
  - [Health](#health)
  - [Ledgers](#ledgers)
  - [Accounts](#accounts)
  - [Transactions](#transactions)
  - [Reports](#reports)
  - [Audit](#audit)
  - [Templates](#templates)
  - [Imports](#imports)
  - [API Keys](#api-keys)

---

## Authentication

Ledge uses two authentication modes:

### API Key Auth

For ledger operations (accounts, transactions, reports, audit, imports). API keys are scoped to a single ledger.

Provide the key in either header:

```
Authorization: Bearer ledge_live_xxxxxxxxxxxxxxxx
```

or:

```
X-Api-Key: ledge_live_xxxxxxxxxxxxxxxx
```

API keys are created via `POST /v1/api-keys` and shown only once at creation time. Keys are stored as SHA-256 hashes.

### Admin Auth

For bootstrap operations (creating ledgers, managing API keys, applying templates). Uses the `LEDGE_ADMIN_SECRET` environment variable.

```
Authorization: Bearer <LEDGE_ADMIN_SECRET>
```

The admin secret is auto-generated on first container start if not provided. Admin routes also accept a valid API key as a fallback.

---

## Response Format

### Success (single item)

```json
{
  "data": { ... }
}
```

### Success (paginated list)

```json
{
  "data": [ ... ],
  "nextCursor": "<cursor-string>" | null
}
```

### Error

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description",
    "details": [
      {
        "field": "fieldName",
        "expected": "expected value",
        "actual": "actual value",
        "suggestion": "How to fix the error"
      }
    ],
    "requestId": "<uuid>"
  }
}
```

Every error includes a `requestId` for debugging and at least one `details[].suggestion` explaining how to fix the issue.

### HTTP Status Codes

| Status | Meaning |
|--------|--------|
| 200 | Success |
| 201 | Created |
| 400 | Validation error |
| 401 | Missing or invalid authentication |
| 403 | API key not scoped to this ledger |
| 404 | Resource not found |
| 409 | Conflict (duplicate, already reversed) |
| 500 | Internal server error |

---

## Pagination

Paginated endpoints use cursor-based pagination.

| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| `cursor` | string |  |  | Opaque cursor from a previous `nextCursor` response |
| `limit` | integer | 50 | 200 | Number of items per page |

When `nextCursor` is `null`, there are no more pages.

```bash
# First page
curl http://localhost:3001/v1/ledgers/LEDGER_ID/transactions?limit=25 \n  -H "Authorization: Bearer API_KEY"

# Next page (use nextCursor from previous response)
curl "http://localhost:3001/v1/ledgers/LEDGER_ID/transactions?limit=25&cursor=abc123" \n  -H "Authorization: Bearer API_KEY"
```

**Paginated endpoints:** transactions list, audit log, import batches list.

---

## Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid input (missing/malformed fields) |
| `UNBALANCED_TRANSACTION` | 400 | Debits do not equal credits |
| `ACCOUNT_INACTIVE` | 400 | Account has been archived |
| `ACCOUNT_WRONG_LEDGER` | 400 | Account belongs to a different ledger |
| `PERIOD_CLOSED` | 400 | Transaction date falls in a closed period |
| `IMPORT_PARSE_ERROR` | 400 | CSV/OFX file could not be parsed |
| `UNAUTHORIZED` | 401 | Missing or invalid API key / admin secret |
| `FORBIDDEN` | 403 | API key not scoped to the requested ledger |
| `ACCOUNT_NOT_FOUND` | 404 | Account ID or code does not exist |
| `LEDGER_NOT_FOUND` | 404 | Ledger ID does not exist |
| `TRANSACTION_NOT_FOUND` | 404 | Transaction ID does not exist |
| `TEMPLATE_NOT_FOUND` | 404 | Template ID or slug does not exist |
| `IMPORT_NOT_FOUND` | 404 | Import batch ID does not exist |
| `API_KEY_NOT_FOUND` | 404 | API key ID does not exist |
| `TRANSACTION_ALREADY_REVERSED` | 409 | Transaction has already been reversed |
| `IDEMPOTENCY_CONFLICT` | 409 | Idempotency key reused with different data |
| `DUPLICATE_ACCOUNT_CODE` | 409 | Account code already exists in ledger |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

---

## Endpoints

### Health

#### `GET /v1/health`

Health check endpoint. No authentication required.

```bash
curl http://localhost:3001/v1/health
```

**Response** `200`:

```json
{
  "status": "ok",
  "version": "0.1.0",
  "timestamp": "2026-03-10T12:00:00.000Z"
}
```

---

### Ledgers

#### `POST /v1/ledgers`

Create a new ledger. **Auth: admin**

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Ledger name (1-255 chars) |
| `currency` | string | no | 3-letter currency code (default: `"USD"`) |
| `fiscalYearStart` | integer | no | Month number 1-12 (default: `1`) |
| `accountingBasis` | string | no | `"accrual"` or `"cash"` (default: `"accrual"`) |
| `ownerId` | string (UUID) | yes | UUID of the owning user |
| `businessContext` | object | no | Arbitrary metadata |

```bash
curl -X POST http://localhost:3001/v1/ledgers \n  -H "Authorization: Bearer ADMIN_SECRET" \n  -H "Content-Type: application/json" \n  -d '{
    "name": "My Business",
    "currency": "USD",
    "ownerId": "019458a1-b2c3-7def-8901-234567890abc"
  }'
```

**Response** `201`:

```json
{
  "data": {
    "id": "019458a1-0000-7000-8000-000000000001",
    "name": "My Business",
    "currency": "USD",
    "templateId": null,
    "businessContext": null,
    "fiscalYearStart": 1,
    "accountingBasis": "accrual",
    "status": "active",
    "ownerId": "019458a1-b2c3-7def-8901-234567890abc",
    "closedThrough": null,
    "createdAt": "2026-03-10T12:00:00.000Z",
    "updatedAt": "2026-03-10T12:00:00.000Z"
  }
}
```

#### `GET /v1/ledgers/:ledgerId`

Get a ledger by ID. **Auth: api-key**

```bash
curl http://localhost:3001/v1/ledgers/LEDGER_ID \n  -H "Authorization: Bearer API_KEY"
```

**Response** `200`: Same shape as creation response.

---

### Accounts

#### `POST /v1/ledgers/:ledgerId/accounts`

Create an account in a ledger. **Auth: api-key**

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `code` | string | yes | Unique account code (1-50 chars), e.g. `"1000"` |
| `name` | string | yes | Account name (1-255 chars) |
| `type` | string | yes | `"asset"`, `"liability"`, `"equity"`, `"revenue"`, or `"expense"` |
| `normalBalance` | string | no | `"debit"` or `"credit"` (auto-derived from type if omitted) |
| `parentCode` | string | no | Parent account code for sub-accounts |
| `metadata` | object | no | Arbitrary metadata |

```bash
curl -X POST http://localhost:3001/v1/ledgers/LEDGER_ID/accounts \n  -H "Authorization: Bearer API_KEY" \n  -H "Content-Type: application/json" \n  -d '{ "code": "1000", "name": "Cash", "type": "asset" }'
```

**Response** `201`:

```json
{
  "data": {
    "id": "...",
    "ledgerId": "LEDGER_ID",
    "parentId": null,
    "code": "1000",
    "name": "Cash",
    "type": "asset",
    "normalBalance": "debit",
    "isSystem": false,
    "metadata": null,
    "status": "active",
    "createdAt": "2026-03-10T12:00:00.000Z",
    "updatedAt": "2026-03-10T12:00:00.000Z"
  }
}
```

#### `GET /v1/ledgers/:ledgerId/accounts`

List all accounts with current balances. **Auth: api-key**

```bash
curl http://localhost:3001/v1/ledgers/LEDGER_ID/accounts \n  -H "Authorization: Bearer API_KEY"
```

**Response** `200`:

```json
{
  "data": [
    {
      "id": "...",
      "code": "1000",
      "name": "Cash",
      "type": "asset",
      "normalBalance": "debit",
      "balance": 500000,
      "status": "active"
    }
  ]
}
```

> **Note:** `balance` is in the smallest currency unit (cents). `500000` = $5,000.00.

#### `GET /v1/ledgers/:ledgerId/accounts/:accountId`

Get a single account by ID. Returns 404 if the account belongs to a different ledger. **Auth: api-key**

```bash
curl http://localhost:3001/v1/ledgers/LEDGER_ID/accounts/ACCOUNT_ID \n  -H "Authorization: Bearer API_KEY"
```

**Response** `200`: Same shape as list item.

---

### Transactions

#### `POST /v1/ledgers/:ledgerId/transactions`

Post a new transaction. Debits must equal credits. **Auth: api-key**

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `date` | string | yes | Transaction date (`YYYY-MM-DD`) |
| `effectiveDate` | string | no | Effective date if different from posting date |
| `memo` | string | yes | Description (1-1000 chars) |
| `lines` | array | yes | At least 2 line items (see below) |
| `idempotencyKey` | string | no | Unique key for safe retries (max 255 chars) |
| `sourceType` | string | no | `"api"`, `"mcp"`, `"import"`, or `"manual"` (default: `"api"`) |
| `sourceRef` | string | no | External reference (e.g. Stripe invoice ID) |
| `agentId` | string | no | ID of the AI agent that created this |
| `metadata` | object | no | Arbitrary metadata |

**Line item schema:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `accountCode` | string | yes | Account code (must exist in this ledger) |
| `amount` | integer | yes | Positive integer in smallest currency unit |
| `direction` | string | yes | `"debit"` or `"credit"` |
| `memo` | string | no | Line-level memo |
| `metadata` | object | no | Line-level metadata |

**Headers:**

| Header | Description |
|--------|-------------|
| `Idempotency-Key` | Alternative to `idempotencyKey` in body |

```bash
curl -X POST http://localhost:3001/v1/ledgers/LEDGER_ID/transactions \n  -H "Authorization: Bearer API_KEY" \n  -H "Content-Type: application/json" \n  -H "Idempotency-Key: inv_20260310_001" \n  -d '{
    "date": "2026-03-10",
    "memo": "March subscription payment",
    "lines": [
      { "accountCode": "1000", "amount": 4999, "direction": "debit" },
      { "accountCode": "4000", "amount": 4999, "direction": "credit" }
    ]
  }'
```

**Response** `201`:

```json
{
  "data": {
    "id": "...",
    "ledgerId": "LEDGER_ID",
    "idempotencyKey": "inv_20260310_001",
    "date": "2026-03-10",
    "effectiveDate": null,
    "memo": "March subscription payment",
    "status": "posted",
    "sourceType": "api",
    "sourceRef": null,
    "agentId": null,
    "metadata": null,
    "postedAt": "2026-03-10T12:00:00.000Z",
    "createdAt": "2026-03-10T12:00:00.000Z",
    "updatedAt": "2026-03-10T12:00:00.000Z",
    "lines": [
      {
        "id": "...",
        "transactionId": "...",
        "accountId": "...",
        "amount": 4999,
        "direction": "debit",
        "memo": null,
        "metadata": null
      },
      {
        "id": "...",
        "transactionId": "...",
        "accountId": "...",
        "amount": 4999,
        "direction": "credit",
        "memo": null,
        "metadata": null
      }
    ]
  }
}
```

> **Idempotency:** If you send the same `idempotencyKey` with the same data, the original transaction is returned. If the data differs, you get an `IDEMPOTENCY_CONFLICT` error (409).

#### `GET /v1/ledgers/:ledgerId/transactions`

List transactions with cursor-based pagination. **Auth: api-key**

**Query parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `cursor` | string | | Pagination cursor from previous response |
| `limit` | integer | 50 | Results per page (1-200) |

```bash
curl http://localhost:3001/v1/ledgers/LEDGER_ID/transactions?limit=10 \
  -H "Authorization: Bearer API_KEY"
```

**Response** `200`:

```json
{
  "data": [
    {
      "id": "...",
      "ledgerId": "LEDGER_ID",
      "date": "2026-03-10",
      "memo": "March subscription payment",
      "status": "posted",
      "lines": [ ... ]
    }
  ],
  "nextCursor": "eyJpZCI6Ij..."
}
```

#### `GET /v1/ledgers/:ledgerId/transactions/:transactionId`

Get a single transaction with its line items. Returns 404 if the transaction belongs to a different ledger. **Auth: api-key**

```bash
curl http://localhost:3001/v1/ledgers/LEDGER_ID/transactions/TXN_ID \
  -H "Authorization: Bearer API_KEY"
```

**Response** `200`: Same shape as POST creation response (includes `lines` array).

#### `POST /v1/ledgers/:ledgerId/transactions/:transactionId/reverse`

Reverse a posted transaction by creating an offsetting entry. Transactions are immutable — reversals create new entries. **Auth: api-key**

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `reason` | string | yes | Reason for reversal (1-1000 chars) |

```bash
curl -X POST http://localhost:3001/v1/ledgers/LEDGER_ID/transactions/TXN_ID/reverse \
  -H "Authorization: Bearer API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "reason": "Customer refund" }'
```

**Response** `201`: Returns the new reversal transaction (with reversed line items). The original transaction's status changes to `"reversed"`.

> **Note:** Reversing an already-reversed transaction returns a `TRANSACTION_ALREADY_REVERSED` error (409).

---


### Reports

#### `GET /v1/ledgers/:ledgerId/reports/income-statement`

Generate an Income Statement (P&L) for a date range. **Auth: api-key**

**Query parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `startDate` | string | yes | Start date (`YYYY-MM-DD`) |
| `endDate` | string | yes | End date (`YYYY-MM-DD`) |

```bash
curl "http://localhost:3001/v1/ledgers/LEDGER_ID/reports/income-statement?startDate=2026-01-01&endDate=2026-03-31" \
  -H "Authorization: Bearer API_KEY"
```

**Response** `200`:

```json
{
  "data": {
    "ledgerId": "LEDGER_ID",
    "startDate": "2026-01-01",
    "endDate": "2026-03-31",
    "currency": "USD",
    "revenue": {
      "accounts": [
        { "code": "4000", "name": "Revenue", "balance": 1500000 }
      ],
      "total": 1500000
    },
    "expenses": {
      "accounts": [
        { "code": "5000", "name": "Cost of Goods Sold", "balance": 600000 }
      ],
      "total": 600000
    },
    "netIncome": 900000
  }
}
```

#### `GET /v1/ledgers/:ledgerId/reports/balance-sheet`

Generate a Balance Sheet as of a specific date. **Auth: api-key**

**Query parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `asOfDate` | string | yes | Point-in-time date (`YYYY-MM-DD`) |

```bash
curl "http://localhost:3001/v1/ledgers/LEDGER_ID/reports/balance-sheet?asOfDate=2026-03-31" \
  -H "Authorization: Bearer API_KEY"
```

**Response** `200`:

```json
{
  "data": {
    "ledgerId": "LEDGER_ID",
    "asOfDate": "2026-03-31",
    "currency": "USD",
    "assets": {
      "accounts": [
        { "code": "1000", "name": "Cash", "balance": 2500000 }
      ],
      "total": 2500000
    },
    "liabilities": {
      "accounts": [],
      "total": 0
    },
    "equity": {
      "accounts": [
        { "code": "3000", "name": "Owner Equity", "balance": 1600000 }
      ],
      "total": 1600000
    },
    "retainedEarnings": 900000
  }
}
```

#### `GET /v1/ledgers/:ledgerId/reports/cash-flow`

Generate a Cash Flow Statement for a date range. **Auth: api-key**

**Query parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `startDate` | string | yes | Start date (`YYYY-MM-DD`) |
| `endDate` | string | yes | End date (`YYYY-MM-DD`) |

```bash
curl "http://localhost:3001/v1/ledgers/LEDGER_ID/reports/cash-flow?startDate=2026-01-01&endDate=2026-03-31" \
  -H "Authorization: Bearer API_KEY"
```

**Response** `200`:

```json
{
  "data": {
    "ledgerId": "LEDGER_ID",
    "startDate": "2026-01-01",
    "endDate": "2026-03-31",
    "currency": "USD",
    "operating": {
      "items": [
        { "description": "Net Income", "amount": 900000 }
      ],
      "total": 900000
    },
    "investing": {
      "items": [],
      "total": 0
    },
    "financing": {
      "items": [],
      "total": 0
    },
    "netChange": 900000,
    "beginningCash": 1600000,
    "endingCash": 2500000
  }
}
```

---


### Audit

#### `GET /v1/ledgers/:ledgerId/audit`

List audit trail entries with cursor-based pagination. Records all changes to accounts, transactions, and ledger settings. **Auth: api-key**

**Query parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `cursor` | string | | Pagination cursor |
| `limit` | integer | 50 | Results per page (1-200) |

```bash
curl http://localhost:3001/v1/ledgers/LEDGER_ID/audit?limit=25 \
  -H "Authorization: Bearer API_KEY"
```

**Response** `200`:

```json
{
  "data": [
    {
      "id": "...",
      "ledgerId": "LEDGER_ID",
      "entityType": "transaction",
      "entityId": "...",
      "action": "created",
      "actorId": "...",
      "actorType": "api_key",
      "changes": {},
      "createdAt": "2026-03-10T12:00:00.000Z"
    }
  ],
  "nextCursor": null
}
```

---


### Templates

#### `GET /v1/templates`

List all available business templates. **Auth: none**

```bash
curl http://localhost:3001/v1/templates
```

**Response** `200`:

```json
{
  "data": [
    {
      "id": "...",
      "slug": "saas",
      "name": "SaaS",
      "description": "Software-as-a-Service subscription business",
      "currency": "USD",
      "accountingBasis": "accrual",
      "accounts": [ ... ]
    }
  ]
}
```

Available template slugs: `saas`, `marketplace`, `agency`, `ecommerce`, `creator`, `consulting`, `property`, `nonprofit`.

#### `GET /v1/templates/:idOrSlug`

Get a single template by ID or slug. **Auth: none**

```bash
curl http://localhost:3001/v1/templates/saas
```

**Response** `200`: Single template object (same shape as list item).

#### `POST /v1/templates/recommend`

Get template recommendations based on business context. **Auth: none**

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `industry` | string | no | Industry name |
| `description` | string | no | Business description |
| `businessModel` | string | no | Business model type |

```bash
curl -X POST http://localhost:3001/v1/templates/recommend \
  -H "Content-Type: application/json" \
  -d '{ "industry": "technology", "description": "B2B SaaS platform" }'
```

**Response** `200`:

```json
{
  "data": [
    { "slug": "saas", "name": "SaaS", "score": 0.95 },
    { "slug": "marketplace", "name": "Marketplace", "score": 0.40 }
  ]
}
```

#### `POST /v1/templates/apply`

Apply a template to a ledger, creating its chart of accounts. **Auth: admin**

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ledgerId` | string (UUID) | yes | Target ledger ID |
| `templateSlug` | string | yes | Template slug to apply |

```bash
curl -X POST http://localhost:3001/v1/templates/apply \
  -H "Authorization: Bearer ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{ "ledgerId": "LEDGER_ID", "templateSlug": "saas" }'
```

**Response** `200`:

```json
{
  "data": {
    "accounts": [
      { "id": "...", "code": "1000", "name": "Cash", "type": "asset" },
      { "id": "...", "code": "1100", "name": "Accounts Receivable", "type": "asset" }
    ],
    "count": 20
  }
}
```

---


### Imports

#### `POST /v1/ledgers/:ledgerId/imports`

Upload a bank statement file (CSV or OFX) for reconciliation. The file is parsed and run through the matching engine automatically. **Auth: api-key**

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `fileContent` | string | yes | File content (raw CSV or OFX text) |
| `fileType` | string | yes | `"csv"` or `"ofx"` |
| `filename` | string | no | Original filename for reference |

```bash
curl -X POST http://localhost:3001/v1/ledgers/LEDGER_ID/imports \
  -H "Authorization: Bearer API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "fileContent": "date,description,amount\n2026-03-01,Subscription Payment,49.99",
    "fileType": "csv",
    "filename": "march-bank.csv"
  }'
```

**Response** `201`:

```json
{
  "data": {
    "id": "...",
    "ledgerId": "LEDGER_ID",
    "filename": "march-bank.csv",
    "fileType": "csv",
    "status": "pending",
    "totalRows": 1,
    "matchedRows": 0,
    "unmatchedRows": 1,
    "rows": [
      {
        "id": "...",
        "date": "2026-03-01",
        "description": "Subscription Payment",
        "amount": 4999,
        "status": "unmatched",
        "matchConfidence": null,
        "matchedTransactionId": null
      }
    ],
    "createdAt": "2026-03-10T12:00:00.000Z"
  }
}
```

#### `GET /v1/ledgers/:ledgerId/imports`

List import batches with cursor-based pagination. **Auth: api-key**

**Query parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `cursor` | string | | Pagination cursor |
| `limit` | integer | 50 | Results per page (1-200) |

```bash
curl http://localhost:3001/v1/ledgers/LEDGER_ID/imports \
  -H "Authorization: Bearer API_KEY"
```

**Response** `200`: Paginated list of import batch summaries (without `rows`).

#### `GET /v1/imports/:batchId`

Get a single import batch with all its rows and match details. **Auth: api-key**

```bash
curl http://localhost:3001/v1/imports/BATCH_ID \
  -H "Authorization: Bearer API_KEY"
```

**Response** `200`: Full batch object including `rows` array with match status and confidence scores.

#### `POST /v1/imports/:batchId/confirm`

Confirm or reject matched import rows. **Auth: api-key**

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `actions` | array | yes | Array of row actions (see below) |

**Row action schema:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `rowId` | string (UUID) | yes | Import row ID |
| `action` | string | yes | `"confirm"`, `"reject"`, or `"override"` |
| `overrideTransactionId` | string (UUID) | no | Required when action is `"override"` |

```bash
curl -X POST http://localhost:3001/v1/imports/BATCH_ID/confirm \
  -H "Authorization: Bearer API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "actions": [
      { "rowId": "ROW_ID_1", "action": "confirm" },
      { "rowId": "ROW_ID_2", "action": "reject" },
      { "rowId": "ROW_ID_3", "action": "override", "overrideTransactionId": "TXN_ID" }
    ]
  }'
```

**Response** `200`: Updated batch object with new row statuses.

---


### API Keys

#### `POST /v1/api-keys`

Create a new API key for a ledger. The raw key is returned only once. **Auth: admin**

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userId` | string (UUID) | yes | User who owns this key |
| `ledgerId` | string (UUID) | yes | Ledger this key is scoped to |
| `name` | string | yes | Human-readable key name |

```bash
curl -X POST http://localhost:3001/v1/api-keys \
  -H "Authorization: Bearer ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "USER_ID",
    "ledgerId": "LEDGER_ID",
    "name": "Production Key"
  }'
```

**Response** `201`:

```json
{
  "data": {
    "id": "...",
    "userId": "USER_ID",
    "ledgerId": "LEDGER_ID",
    "name": "Production Key",
    "prefix": "ledge_live_",
    "rawKey": "ledge_live_abc123def456...",
    "createdAt": "2026-03-10T12:00:00.000Z"
  }
}
```

> **Important:** Save the `rawKey` immediately — it cannot be retrieved again. Only the SHA-256 hash is stored.

#### `GET /v1/api-keys?ledgerId=xxx`

List API keys for a ledger (without key hashes). **Auth: admin**

**Query parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `ledgerId` | string (UUID) | yes | Ledger to list keys for |

```bash
curl "http://localhost:3001/v1/api-keys?ledgerId=LEDGER_ID" \
  -H "Authorization: Bearer ADMIN_SECRET"
```

**Response** `200`:

```json
{
  "data": [
    {
      "id": "...",
      "userId": "USER_ID",
      "ledgerId": "LEDGER_ID",
      "name": "Production Key",
      "prefix": "ledge_live_",
      "createdAt": "2026-03-10T12:00:00.000Z"
    }
  ]
}
```

#### `DELETE /v1/api-keys/:keyId`

Revoke an API key. The key immediately stops working. **Auth: admin**

```bash
curl -X DELETE http://localhost:3001/v1/api-keys/KEY_ID \
  -H "Authorization: Bearer ADMIN_SECRET"
```

**Response** `200`: Returns the revoked key metadata (without key hash).

---


## Quick Reference

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/v1/health` | none | Health check |
| POST | `/v1/ledgers` | admin | Create a ledger |
| GET | `/v1/ledgers/:ledgerId` | api-key | Get a ledger |
| POST | `/v1/ledgers/:ledgerId/accounts` | api-key | Create an account |
| GET | `/v1/ledgers/:ledgerId/accounts` | api-key | List accounts with balances |
| GET | `/v1/ledgers/:ledgerId/accounts/:accountId` | api-key | Get an account |
| POST | `/v1/ledgers/:ledgerId/transactions` | api-key | Post a transaction |
| GET | `/v1/ledgers/:ledgerId/transactions` | api-key | List transactions (paginated) |
| GET | `/v1/ledgers/:ledgerId/transactions/:transactionId` | api-key | Get a transaction |
| POST | `/v1/ledgers/:ledgerId/transactions/:transactionId/reverse` | api-key | Reverse a transaction |
| GET | `/v1/ledgers/:ledgerId/reports/income-statement` | api-key | Income Statement (P&L) |
| GET | `/v1/ledgers/:ledgerId/reports/balance-sheet` | api-key | Balance Sheet |
| GET | `/v1/ledgers/:ledgerId/reports/cash-flow` | api-key | Cash Flow Statement |
| GET | `/v1/ledgers/:ledgerId/audit` | api-key | Audit trail (paginated) |
| GET | `/v1/templates` | none | List templates |
| GET | `/v1/templates/:idOrSlug` | none | Get a template |
| POST | `/v1/templates/recommend` | none | Recommend templates |
| POST | `/v1/templates/apply` | admin | Apply template to ledger |
| POST | `/v1/ledgers/:ledgerId/imports` | api-key | Upload bank statement |
| GET | `/v1/ledgers/:ledgerId/imports` | api-key | List import batches |
| GET | `/v1/imports/:batchId` | api-key | Get import batch detail |
| POST | `/v1/imports/:batchId/confirm` | api-key | Confirm/reject matches |
| POST | `/v1/api-keys` | admin | Create an API key |
| GET | `/v1/api-keys?ledgerId=xxx` | admin | List API keys |
| DELETE | `/v1/api-keys/:keyId` | admin | Revoke an API key |


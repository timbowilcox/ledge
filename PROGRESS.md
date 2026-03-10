# Ledge — Build Progress

## Project Overview

Ledge is a programmable double-entry ledger and reporting engine, embeddable via API, SDK, and MCP.
Monorepo with 5 packages, ~8,645 lines of TypeScript, 235 tests passing.

## Tech Stack

- TypeScript (strict), Hono (API), sql.js/SQLite (embedded DB), Zod (validation)
- Next.js (dashboard), Turborepo (monorepo), Vitest (tests)
- Docker (single-container deployment)

## Monorepo Structure

```
packages/
  core/       # @ledge/core — double-entry engine, domain logic (16 files, ~3,892 LOC)
  api/        # @ledge/api — REST API via Hono (13 files, ~1,217 LOC)
  mcp/        # @ledge/mcp — MCP server (12 files, ~935 LOC)
  sdk/        # @ledge/sdk — TypeScript client SDK (1 file, 560 LOC)
  dashboard/  # @ledge/dashboard — Next.js dashboard (17 files, ~2,041 LOC)
```

## Stages Complete

### Stage 1: Core Engine
- Double-entry ledger engine with balance enforcement (debits must equal credits)
- Account types: asset, liability, equity, revenue, expense
- Immutable transactions — reversals create offsetting entries
- Idempotency keys for safe retries
- Amounts as integers in smallest currency unit (cents)
- UUID v7 primary keys, UTC ISO 8601 timestamps

### Stage 2: REST API (Hono)
- 25 HTTP endpoints across 8 route modules
- API key auth (ledge_live_xxx / ledge_test_xxx) and admin secret auth
- Request ID tracking, cursor-based pagination
- All error responses include details[].suggestion field

### Stage 3: Templates & Statements
- 8 business templates: saas, marketplace, agency, ecommerce, creator, consulting, property, nonprofit
- Each template: pre-configured chart of accounts (20-25 accounts), currency, accounting basis
- Template recommendation engine (POST /v1/templates/recommend)
- Financial statements: Income Statement (P&L), Balance Sheet, Cash Flow

### Stage 4: MCP Server
- 12 tools: setup_ledger, complete_setup, post_transaction, reverse_transaction,
  search_transactions, list_accounts, create_account, get_statement, import_file,
  confirm_matches, get_import_batch, get_usage
- 4 resources: chart-of-accounts, pnl, balance-sheet, recent-transactions
- 3 prompts: monthly-close, reconcile-bank, explain-statement

### Stage 5: Import & Reconciliation
- CSV and OFX file parsing
- Matching engine for bank statement reconciliation
- Import batches with confirm/reject/override workflow

### Stage 6: TypeScript SDK
- Single-module client SDK (packages/sdk/src/index.ts)
- 8 sub-modules: ledgers, accounts, transactions, reports, audit, imports, templates, apiKeys
- LedgeApiError class, full TypeScript types
- 35 tests

### Stage 7: Next.js Dashboard
- 11 pages/routes with Tailwind CDN styling
- Pages: landing, signin, dashboard home, accounts, transactions, statements, api-keys, mcp
- NextAuth integration, sidebar navigation
- Mock data for development

### Stage 8: Example Apps
- **SaaS Subscription Tracker** (`examples/saas-tracker/`)
  - Next.js app using @ledge/sdk to track SaaS subscription revenue
  - Stripe webhook handler: `invoice.payment_succeeded` -> journal entry (debit Cash, credit Subscription Revenue)
  - Live P&L and Balance Sheet via `ledge.reports.incomeStatement()` and `ledge.reports.balanceSheet()`
  - Uses SaaS template (18 accounts: Subscription Revenue, Deferred Revenue, Hosting, etc.)
  - Idempotent transactions keyed by Stripe invoice ID
  - Simulate Payment button for testing without Stripe
  - Seed script to bootstrap ledger, template, API key, and 12 sample transactions
  - Comprehensive README with setup guide, architecture diagram, and extension ideas
- **Freelancer Invoice Manager** (`examples/invoice-manager/`)
  - Next.js app using @ledge/sdk to manage invoices, payments, and expenses
  - Three interactive forms: Create Invoice, Record Payment, Record Expense
  - Create Invoice: debit Accounts Receivable, credit Consulting Fees
  - Record Payment: debit Cash, credit Accounts Receivable
  - Record Expense: debit expense account (6 categories), credit Cash
  - Uses Consulting template (17 accounts: Consulting Fees, Advisory Retainers, Subcontractor Costs, etc.)
  - Live Income Statement, Balance Sheet, account balances, and transaction journal
  - Seed script with 8 sample transactions (invoices, payments, and expenses)
  - Comprehensive README with setup guide, architecture diagram, and extension ideas
- **Expense Tracker with CSV Import** (`examples/expense-tracker/`)
  - Next.js app using @ledge/sdk to record expenses and reconcile bank statements
  - Record expenses across 7 categories (COGS, Shipping, Marketing, Salaries, Platform Fees, G&A, Packaging)
  - CSV import via `ledge.imports.upload()` — parses and runs matching engine automatically
  - Reconciliation engine: confidence scoring (date 0-40, amount 0-40, text 0-20), auto-match >= 0.95, suggest >= 0.60
  - Match review UI: visual confidence bars, status badges (matched/suggested/unmatched), per-row confirm/reject
  - Uses E-commerce template (20 accounts: Product Sales, COGS, Marketing, Platform Fees, etc.)
  - Sample bank statement CSV (12 rows: 10 matching seed data, 2 unmatched)
  - Seed script with 10 sample transactions (8 expenses + 2 revenue entries)
  - Comprehensive README with setup guide, architecture diagram, and extension ideas

### Stage 9: Docker, Error Review, Performance
- **Docker image**: Multi-stage Dockerfile (builder -> pruner -> runtime)
  - Single container: docker run -p 3001:3001 getledge/ledge
  - Persistent storage via LEDGE_DATA_DIR volume mount (/data)
  - Auto-generates LEDGE_ADMIN_SECRET on first run
  - Graceful shutdown with database persistence
  - Healthcheck at /v1/health, non-root user (ledge:1001)
- **Error review**: Every error across the entire API includes details[].suggestion
  - Updated: 18 core error codes, 8 route files, auth middleware (5 errors), global handler, 404
- **Performance**: 989 txn/s sustained (target: 100 — nearly 10x)
  - 1,100+ reads/s, 13,000+ paginated pages/s
  - Balance integrity verified after 500 transactions

### Stage 10: API Documentation
- **API Reference** (`docs/api-reference.md`) — 1,009 lines
  - All 25 REST endpoints documented with method, path, auth, description
  - Request body schemas with field types, required/optional, descriptions
  - Response schemas with example JSON
  - curl examples for every endpoint
  - Authentication guide (API key auth + admin auth)
  - Pagination guide (cursor-based, limit 1-200, default 50)
  - Error codes reference (18 codes with HTTP status and description)
  - Quick reference table (25-row endpoint summary)

### Stage 11: SDK, MCP & Template Documentation
- **SDK Guide** (`docs/sdk-guide.md`) — 575 lines
  - Installation and initialisation
  - All 8 SDK modules documented with method signatures and examples
  - Ledgers, accounts, transactions, reports, audit, imports, templates, apiKeys
  - Error handling with LedgeApiError
  - Pagination patterns
  - Full end-to-end workflow example
  - Type reference and custom fetch
- **MCP Guide** (`docs/mcp-guide.md`) — 520 lines
  - Connection instructions for Claude Code, Cursor, and any MCP client
  - All 12 tools documented with parameters and examples
  - 4 resources with URI templates
  - 3 prompt templates with workflow steps
  - Typical conversation flow example
- **Template Reference** (`docs/template-reference.md`) — 399 lines
  - All 8 templates with complete chart of accounts tables
  - Account code convention (1000s–6000s)
  - Quick reference table (slug, accounts, currency, basis, business type)
  - Recommended use cases and keywords for each template
  - Usage examples via SDK, REST API, and MCP

### Stage 12: Dashboard Styling & UI Modernization
- **Tailwind v4 fix**: Created postcss.config.mjs with @tailwindcss/postcss plugin, added @import "tailwindcss" to globals.css, removed CDN script from layout.tsx, deleted conflicting root page.tsx that shadowed the dashboard overview
- **UI modernization** (inspired by Sana Labs):
  - Custom easing: cubic-bezier(0.16, 1, 0.3, 1) on all transitions
  - Generous whitespace: 28–48px padding, 20–40px gaps between elements
  - Smooth transitions: 200–300ms with custom easing curve
  - Subtle hover effects: translateY(-1px), background color shifts
  - Refined typography: larger headings (24–28px), improved line-height
  - Larger border radii: 12–24px throughout
  - Sidebar: 260px wide with right border, darker background, 40px logo margin
  - Cards: 20px radius, 28px padding, hover lift + border glow
  - Inputs: 14px radius with teal focus ring
  - Tables: 16px 20px cell padding
- **Files rewritten** (11 total):
  - globals.css (237 lines): CSS variables, cards, buttons, badges, tables, inputs, skeleton
  - sidebar.tsx (188 lines): wider sidebar with hover effects and glow logo
  - (dashboard)/layout.tsx (23 lines): 260px margin, 40px 48px padding
  - (dashboard)/page.tsx (123 lines): overview metrics + transaction table
  - accounts/page.tsx (159 lines): collapsible account tree
  - transactions/page.tsx (203 lines): search, filters, pagination
  - statements/page.tsx (238 lines): tabs, date range, summary
  - api-keys/page.tsx (189 lines): key table + create modal
  - mcp/page.tsx (191 lines): connection guide with tool cards
  - signin/page.tsx (143 lines): centered OAuth card
  - templates/page.tsx (83 lines): template picker grid
- **Verified**: All 8 routes screenshot-verified at 1440x900 viewport

## API Endpoints

| Method | Path | Auth |
|--------|------|------|
| GET | /v1/health | none |
| POST | /v1/ledgers | admin |
| GET | /v1/ledgers/:ledgerId | api-key |
| POST | /v1/ledgers/:ledgerId/accounts | api-key |
| GET | /v1/ledgers/:ledgerId/accounts | api-key |
| GET | /v1/ledgers/:ledgerId/accounts/:accountId | api-key |
| POST | /v1/ledgers/:ledgerId/transactions | api-key |
| GET | /v1/ledgers/:ledgerId/transactions | api-key |
| GET | /v1/ledgers/:ledgerId/transactions/:transactionId | api-key |
| POST | /v1/ledgers/:ledgerId/transactions/:transactionId/reverse | api-key |
| GET | /v1/ledgers/:ledgerId/reports/income-statement | api-key |
| GET | /v1/ledgers/:ledgerId/reports/balance-sheet | api-key |
| GET | /v1/ledgers/:ledgerId/reports/cash-flow | api-key |
| GET | /v1/ledgers/:ledgerId/audit | api-key |
| GET | /v1/templates | none |
| GET | /v1/templates/:idOrSlug | none |
| POST | /v1/templates/recommend | none |
| POST | /v1/templates/apply | admin |
| POST | /v1/ledgers/:ledgerId/imports | api-key |
| GET | /v1/ledgers/:ledgerId/imports | api-key |
| GET | /v1/imports/:batchId | api-key |
| POST | /v1/imports/:batchId/confirm | api-key |
| POST | /v1/api-keys | admin |
| GET | /v1/api-keys?ledgerId=xxx | admin |
| DELETE | /v1/api-keys/:keyId | admin |

## Test Status

| Package | Tests | Status |
|---------|-------|--------|
| @ledge/core | 129 | passing |
| @ledge/mcp | 36 | passing |
| @ledge/api | 35 (31 integration + 4 benchmark) | passing |
| @ledge/sdk | 35 | passing |
| **Total** | **235** | **all passing** |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3001 | HTTP port |
| LEDGE_DATA_DIR | (in-memory) | Directory for persistent SQLite file |
| LEDGE_ADMIN_SECRET | (auto-generated) | Admin secret for bootstrap operations |

## Key Files

- packages/core/src/engine/index.ts — LedgerEngine (main business logic)
- packages/core/src/types/index.ts — All entity types
- packages/core/src/schemas/index.ts — Zod validation schemas
- packages/core/src/errors/index.ts — 18 error codes with details
- packages/core/src/templates/index.ts — 8 business templates
- packages/core/src/statements/index.ts — Financial statement generators
- packages/core/src/import/index.ts — CSV/OFX parsing, matching engine
- packages/core/src/db/sqlite.ts — sql.js WASM SQLite wrapper
- packages/core/src/db/migrations/ — 3 migration SQL files
- packages/api/src/app.ts — Hono app with all route mounts
- packages/api/src/index.ts — Server entry point (0.0.0.0:3001)
- packages/api/src/middleware/auth.ts — API key + admin auth
- packages/api/src/routes/ — 8 route files (ledgers, accounts, transactions, templates, reports, audit, api-keys, imports)
- packages/mcp/src/index.ts — MCP server entry
- packages/sdk/src/index.ts — Full SDK client (560 LOC)
- packages/dashboard/src/app/ — Next.js pages
- docs/api-reference.md — API reference documentation (1,009 lines)
- docs/sdk-guide.md — SDK usage guide (575 lines)
- docs/mcp-guide.md — MCP server guide (520 lines)
- docs/template-reference.md — Template reference (399 lines)
- Dockerfile — Multi-stage Docker build
- docker-entrypoint.sh — Container startup script

## Database Migrations

1. 001_initial_schema.sqlite.sql — Full schema (accounts, transactions, line_items, audit, api_keys, users, ledgers)
2. 002_audit_action_updated.sqlite.sql — Adds 'updated' action to audit trail

## Build Commands

```sh
pnpm install          # install dependencies
pnpm dev              # start all packages in dev mode
pnpm build            # build all packages
pnpm test             # run tests across all packages
pnpm lint             # lint all packages
pnpm typecheck        # type-check all packages
```

## Not Yet Done

### Documentation
- Getting started guide
- Deployment documentation

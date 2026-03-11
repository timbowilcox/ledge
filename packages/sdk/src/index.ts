// ---------------------------------------------------------------------------
// @ledge/sdk — Typed client for the Ledge REST API.
//
// All types are re-exported from @ledge/core so consumers get full type
// coverage without a separate import. Response envelopes ({ data: T }) are
// unwrapped automatically — callers receive the inner payload directly.
// ---------------------------------------------------------------------------

// --- Re-exports from @ledge/core so consumers only need @ledge/sdk ---------

export type {
  // Entity types
  Ledger,
  Account,
  AccountWithBalance,
  Transaction,
  TransactionWithLines,
  LineItem,
  Reversal,
  AuditEntry,
  ImportBatch,
  ImportRow,
  Template,
  TemplateAccount,
  ApiKey,
  User,

  // Input types
  PostTransactionInput,
  PostLineInput,
  ReverseTransactionInput,

  // Statement types
  StatementResponse,
  StatementSection,
  StatementLine,
  StatementPeriod,

  // Enum types
  AccountType,
  NormalBalance,
  Direction,
  TransactionStatus,
  SourceType,
  AccountingBasis,
  LedgerStatus,
  AccountStatus,
  ApiKeyStatus,
  ImportBatchStatus,
  MatchStatus,
  AuditAction,
  ActorType,
  StatementType,

  // Pagination
  PaginatedResult,
  PaginationParams,

  // Errors
  LedgeError,
  ErrorDetail,
} from "@ledge/core";

export type {
  // Schema-derived input types
  CreateLedgerInput,
  CreateAccountInput,
  CreateImportInput,
  ConfirmMatchesInput,
} from "@ledge/core";

export { ErrorCode } from "@ledge/core";

export type { ConfirmAction } from "@ledge/core";

// --- Internal type imports -------------------------------------------------

import type {
  Ledger,
  Account,
  AccountWithBalance,
  TransactionWithLines,
  AuditEntry,
  ImportBatch,
  ImportRow,
  Template,
  User,
  StatementResponse,
  PaginatedResult,
} from "@ledge/core";

import type {
  CreateLedgerInput,
  CreateAccountInput,
} from "@ledge/core";

import type { ConfirmAction } from "@ledge/core";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface LedgeConfig {
  /** API key (starts with `ldg_`). Required. */
  readonly apiKey: string;

  /**
   * Admin secret for privileged operations (ledger creation, API key
   * management, template application). Optional — only needed if the SDK
   * is used for admin tasks.
   */
  readonly adminSecret?: string;

  /** Base URL of the Ledge API. Defaults to `https://api.getledge.ai`. */
  readonly baseUrl?: string;

  /** Custom fetch implementation (useful for testing or edge runtimes). */
  readonly fetch?: typeof globalThis.fetch;
}

/** Options for paginated list endpoints. */
export interface ListOptions {
  readonly cursor?: string;
  readonly limit?: number;
}

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

/** Structured error thrown for non-2xx API responses. */
export class LedgeApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: readonly unknown[];
  readonly requestId?: string;

  constructor(
    status: number,
    body: { code: string; message: string; details?: unknown[]; requestId?: string },
  ) {
    super(body.message);
    this.name = "LedgeApiError";
    this.status = status;
    this.code = body.code;
    this.details = body.details;
    this.requestId = body.requestId;
  }
}

// ---------------------------------------------------------------------------
// Query-string helper
// ---------------------------------------------------------------------------

const buildQuery = (params: Record<string, string | number | boolean | undefined>): string => {
  const qs = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined) qs.set(key, String(val));
  }
  const str = qs.toString();
  return str ? `?${str}` : "";
};

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class Ledge {
  /** @internal */ readonly _apiKey: string;
  /** @internal */ readonly _adminSecret: string | undefined;
  /** @internal */ readonly _baseUrl: string;
  /** @internal */ readonly _fetch: typeof globalThis.fetch;

  readonly ledgers: LedgersModule;
  readonly accounts: AccountsModule;
  readonly transactions: TransactionsModule;
  readonly reports: ReportsModule;
  readonly audit: AuditModule;
  readonly imports: ImportsModule;
  readonly templates: TemplatesModule;
  readonly apiKeys: ApiKeysModule;
  readonly admin: AdminModule;

  constructor(config: LedgeConfig) {
    this._apiKey = config.apiKey;
    this._adminSecret = config.adminSecret;
    this._baseUrl = (config.baseUrl ?? "https://api.getledge.ai").replace(/\/+$/, "");
    this._fetch = config.fetch ?? globalThis.fetch.bind(globalThis);

    this.ledgers = new LedgersModule(this);
    this.accounts = new AccountsModule(this);
    this.transactions = new TransactionsModule(this);
    this.reports = new ReportsModule(this);
    this.audit = new AuditModule(this);
    this.imports = new ImportsModule(this);
    this.templates = new TemplatesModule(this);
    this.apiKeys = new ApiKeysModule(this);
    this.admin = new AdminModule(this);
  }

  // -------------------------------------------------------------------------
  // Internal HTTP transport
  // -------------------------------------------------------------------------

  /**
   * @internal Issue a request and unwrap the `{ data: T }` envelope.
   * For paginated endpoints use {@link requestPaginated} instead.
   */
  async request<T>(
    method: string,
    path: string,
    opts?: { body?: unknown; auth?: "apiKey" | "admin"; headers?: Record<string, string> },
  ): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...this.authHeader(opts?.auth ?? "apiKey"),
      ...opts?.headers,
    };

    const res = await this._fetch(`${this._baseUrl}${path}`, {
      method,
      headers,
      body: opts?.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });

    if (!res.ok) {
      const errBody = (await res.json().catch(() => ({
        error: { code: "UNKNOWN", message: res.statusText },
      }))) as { error: { code: string; message: string; details?: unknown[]; requestId?: string } };
      throw new LedgeApiError(res.status, errBody.error);
    }

    // 204 No Content
    if (res.status === 204) return undefined as T;

    const json = (await res.json()) as { data: T };
    return json.data;
  }

  /**
   * @internal Issue a paginated GET and return `{ data, nextCursor }`.
   */
  async requestPaginated<T>(path: string, opts?: { auth?: "apiKey" | "admin" }): Promise<PaginatedResult<T>> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...this.authHeader(opts?.auth ?? "apiKey"),
    };

    const res = await this._fetch(`${this._baseUrl}${path}`, {
      method: "GET",
      headers,
    });

    if (!res.ok) {
      const errBody = (await res.json().catch(() => ({
        error: { code: "UNKNOWN", message: res.statusText },
      }))) as { error: { code: string; message: string; details?: unknown[]; requestId?: string } };
      throw new LedgeApiError(res.status, errBody.error);
    }

    return (await res.json()) as PaginatedResult<T>;
  }

  /** @internal Produce the Authorization header for the given auth mode. */
  private authHeader(mode: "apiKey" | "admin"): Record<string, string> {
    if (mode === "admin") {
      const secret = this._adminSecret;
      if (!secret) throw new Error("adminSecret is required for this operation");
      return { Authorization: `Bearer ${secret}` };
    }
    return { Authorization: `Bearer ${this._apiKey}` };
  }
}

// ---------------------------------------------------------------------------
// Modules
// ---------------------------------------------------------------------------

// --- Ledgers ---------------------------------------------------------------

class LedgersModule {
  constructor(private readonly c: Ledge) {}

  /** Create a new ledger. Requires admin auth. */
  async create(input: CreateLedgerInput & { ownerId: string }): Promise<Ledger> {
    return this.c.request("POST", "/v1/ledgers", { body: input, auth: "admin" });
  }

  /** Retrieve a ledger by ID. */
  async get(ledgerId: string): Promise<Ledger> {
    return this.c.request("GET", `/v1/ledgers/${ledgerId}`);
  }
}

// --- Accounts --------------------------------------------------------------

class AccountsModule {
  constructor(private readonly c: Ledge) {}

  /** Create an account in a ledger. */
  async create(
    ledgerId: string,
    input: Omit<CreateAccountInput, "ledgerId">,
  ): Promise<Account> {
    return this.c.request("POST", `/v1/ledgers/${ledgerId}/accounts`, { body: input });
  }

  /** List all accounts in a ledger (with balances). */
  async list(ledgerId: string): Promise<AccountWithBalance[]> {
    return this.c.request("GET", `/v1/ledgers/${ledgerId}/accounts`);
  }

  /** Retrieve a single account by ID (with balance). */
  async get(ledgerId: string, accountId: string): Promise<AccountWithBalance> {
    return this.c.request("GET", `/v1/ledgers/${ledgerId}/accounts/${accountId}`);
  }
}

// --- Transactions ----------------------------------------------------------

/** Input for posting a transaction via the SDK. `ledgerId` is passed separately. */
export interface PostTransactionParams {
  readonly date: string;
  readonly memo: string;
  readonly lines: readonly {
    readonly accountCode: string;
    readonly amount: number;
    readonly direction: "debit" | "credit";
    readonly memo?: string;
    readonly metadata?: Record<string, unknown>;
  }[];
  readonly effectiveDate?: string;
  readonly idempotencyKey?: string;
  readonly sourceType?: "api" | "mcp" | "import" | "manual";
  readonly sourceRef?: string;
  readonly agentId?: string;
  readonly metadata?: Record<string, unknown>;
}

class TransactionsModule {
  constructor(private readonly c: Ledge) {}

  /** Post a balanced transaction to a ledger. */
  async post(ledgerId: string, input: PostTransactionParams): Promise<TransactionWithLines> {
    return this.c.request("POST", `/v1/ledgers/${ledgerId}/transactions`, {
      body: input,
    });
  }

  /** List transactions in a ledger (paginated). */
  async list(
    ledgerId: string,
    opts?: ListOptions,
  ): Promise<PaginatedResult<TransactionWithLines>> {
    const qs = buildQuery({ cursor: opts?.cursor, limit: opts?.limit });
    return this.c.requestPaginated(`/v1/ledgers/${ledgerId}/transactions${qs}`);
  }

  /** Retrieve a single transaction by ID. */
  async get(ledgerId: string, transactionId: string): Promise<TransactionWithLines> {
    return this.c.request("GET", `/v1/ledgers/${ledgerId}/transactions/${transactionId}`);
  }

  /** Reverse a posted transaction. Creates an offsetting entry. */
  async reverse(
    ledgerId: string,
    transactionId: string,
    reason: string,
  ): Promise<TransactionWithLines> {
    return this.c.request(
      "POST",
      `/v1/ledgers/${ledgerId}/transactions/${transactionId}/reverse`,
      { body: { reason } },
    );
  }
}

// --- Reports ---------------------------------------------------------------

class ReportsModule {
  constructor(private readonly c: Ledge) {}

  /** Generate an income statement (P&L) for a date range. */
  async incomeStatement(
    ledgerId: string,
    startDate: string,
    endDate: string,
  ): Promise<StatementResponse> {
    const qs = buildQuery({ startDate, endDate });
    return this.c.request("GET", `/v1/ledgers/${ledgerId}/reports/income-statement${qs}`);
  }

  /** Generate a balance sheet as of a given date. */
  async balanceSheet(ledgerId: string, asOfDate: string): Promise<StatementResponse> {
    const qs = buildQuery({ asOfDate });
    return this.c.request("GET", `/v1/ledgers/${ledgerId}/reports/balance-sheet${qs}`);
  }

  /** Generate a cash-flow statement for a date range. */
  async cashFlow(
    ledgerId: string,
    startDate: string,
    endDate: string,
  ): Promise<StatementResponse> {
    const qs = buildQuery({ startDate, endDate });
    return this.c.request("GET", `/v1/ledgers/${ledgerId}/reports/cash-flow${qs}`);
  }
}

// --- Audit -----------------------------------------------------------------

class AuditModule {
  constructor(private readonly c: Ledge) {}

  /** List audit entries for a ledger (paginated). */
  async list(
    ledgerId: string,
    opts?: ListOptions,
  ): Promise<PaginatedResult<AuditEntry>> {
    const qs = buildQuery({ cursor: opts?.cursor, limit: opts?.limit });
    return this.c.requestPaginated(`/v1/ledgers/${ledgerId}/audit${qs}`);
  }
}

// --- Imports ---------------------------------------------------------------

/** Result of uploading an import file. */
export interface ImportResult {
  readonly batch: ImportBatch;
  readonly rows: readonly ImportRow[];
}

class ImportsModule {
  constructor(private readonly c: Ledge) {}

  /** Upload a CSV or OFX bank statement for parsing and matching. */
  async upload(
    ledgerId: string,
    input: { fileContent: string; fileType: "csv" | "ofx"; filename?: string },
  ): Promise<ImportResult> {
    return this.c.request("POST", `/v1/ledgers/${ledgerId}/imports`, { body: input });
  }

  /** List import batches for a ledger (paginated). */
  async list(
    ledgerId: string,
    opts?: ListOptions,
  ): Promise<PaginatedResult<ImportBatch>> {
    const qs = buildQuery({ cursor: opts?.cursor, limit: opts?.limit });
    return this.c.requestPaginated(`/v1/ledgers/${ledgerId}/imports${qs}`);
  }

  /** Retrieve an import batch with all its rows. */
  async get(batchId: string): Promise<ImportResult> {
    return this.c.request("GET", `/v1/imports/${batchId}`);
  }

  /** Confirm, reject, or override row matches in an import batch. */
  async confirmMatches(
    batchId: string,
    actions: readonly ConfirmAction[],
  ): Promise<ImportResult> {
    return this.c.request("POST", `/v1/imports/${batchId}/confirm`, {
      body: { actions },
    });
  }
}

// --- Templates -------------------------------------------------------------

/** Template recommendation with score and reasoning. */
export interface TemplateRecommendation {
  readonly template: Template;
  readonly score: number;
  readonly reason: string;
}

class TemplatesModule {
  constructor(private readonly c: Ledge) {}

  /** List all available chart-of-accounts templates. No auth required. */
  async list(): Promise<Template[]> {
    return this.c.request("GET", "/v1/templates");
  }

  /** Get a template by ID or slug. No auth required. */
  async get(idOrSlug: string): Promise<Template> {
    return this.c.request("GET", `/v1/templates/${idOrSlug}`);
  }

  /** Get template recommendations based on business context. No auth required. */
  async recommend(context: {
    industry?: string;
    description?: string;
    businessModel?: string;
  }): Promise<TemplateRecommendation[]> {
    return this.c.request("POST", "/v1/templates/recommend", { body: context });
  }

  /** Apply a template's chart of accounts to a ledger. Requires admin auth. */
  async apply(
    ledgerId: string,
    templateSlug: string,
  ): Promise<{ accounts: Account[]; count: number }> {
    return this.c.request("POST", "/v1/templates/apply", {
      body: { ledgerId, templateSlug },
      auth: "admin",
    });
  }
}

// --- API Keys --------------------------------------------------------------

/** API key with the raw key visible (only returned on creation). */
export interface ApiKeyWithRaw {
  readonly id: string;
  readonly userId: string;
  readonly ledgerId: string;
  readonly prefix: string;
  readonly name: string;
  readonly rawKey: string;
  readonly status: "active" | "revoked";
  readonly lastUsedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** API key as returned from list/revoke (hash and raw key hidden). */
export interface ApiKeySafe {
  readonly id: string;
  readonly userId: string;
  readonly ledgerId: string;
  readonly prefix: string;
  readonly name: string;
  readonly status: "active" | "revoked";
  readonly lastUsedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}


// --- Admin -----------------------------------------------------------------

/** Result of provisioning a user with a ledger and API key. */
export interface ProvisionResult {
  readonly user: User;
  readonly ledger: Ledger;
  readonly apiKey: {
    readonly id: string;
    readonly userId: string;
    readonly ledgerId: string;
    readonly prefix: string;
    readonly name: string;
    readonly rawKey: string;
    readonly status: string;
    readonly createdAt: string;
  };
  readonly needsTemplate: boolean;
  readonly isNew: boolean;
}

class AdminModule {
  constructor(private readonly c: Ledge) {}

  /** Provision a user with a ledger and API key. Requires admin auth. */
  async provision(input: {
    email: string;
    name: string;
    authProvider: string;
    authProviderId: string;
    templateSlug?: string;
  }): Promise<ProvisionResult> {
    return this.c.request("POST", "/v1/admin/provision", {
      body: input,
      auth: "admin",
    });
  }
}
class ApiKeysModule {
  constructor(private readonly c: Ledge) {}

  /** Create a new API key for a user and ledger. Requires admin auth. */
  async create(input: {
    userId: string;
    ledgerId: string;
    name: string;
  }): Promise<ApiKeyWithRaw> {
    return this.c.request("POST", "/v1/api-keys", { body: input, auth: "admin" });
  }

  /** List API keys for a ledger. Requires admin auth. */
  async list(ledgerId: string): Promise<ApiKeySafe[]> {
    const qs = buildQuery({ ledgerId });
    return this.c.request("GET", `/v1/api-keys${qs}`, { auth: "admin" });
  }

  /** Revoke an API key. Requires admin auth. */
  async revoke(keyId: string): Promise<ApiKeySafe> {
    return this.c.request("DELETE", `/v1/api-keys/${keyId}`, { auth: "admin" });
  }
}

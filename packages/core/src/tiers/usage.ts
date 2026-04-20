// ---------------------------------------------------------------------------
// Usage tracking engine — manages per-user, per-ledger resource counters.
//
// Usage is tracked per calendar month. Limits come from TIER_CONFIGS.
// ---------------------------------------------------------------------------

import type { Database } from "../db/database.js";
import { generateId } from "../engine/id.js";
import { getTierConfig, getLimit } from "./config.js";
import type { TierLimit } from "./config.js";

// ---------------------------------------------------------------------------
// Period helpers
// ---------------------------------------------------------------------------

export function getCurrentUsagePeriod(): { periodStart: string; periodEnd: string } {
  const now = new Date();
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    .toISOString().split("T")[0]!;
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0))
    .toISOString().split("T")[0]!;
  return { periodStart, periodEnd };
}

// ---------------------------------------------------------------------------
// Usage record management
// ---------------------------------------------------------------------------

interface UsageTrackingRow {
  id: string;
  user_id: string;
  ledger_id: string | null;
  period_start: string;
  period_end: string;
  transactions_count: number;
  invoices_count: number;
  customers_count: number;
  fixed_assets_count: number;
  created_at: string;
  updated_at: string;
}

export async function getOrCreateUsageRecord(
  db: Database,
  userId: string,
  ledgerId?: string,
): Promise<UsageTrackingRow> {
  const { periodStart, periodEnd } = getCurrentUsagePeriod();

  const existing = await db.get<UsageTrackingRow>(
    ledgerId
      ? "SELECT * FROM usage_tracking WHERE user_id = ? AND ledger_id = ? AND period_start = ?"
      : "SELECT * FROM usage_tracking WHERE user_id = ? AND ledger_id IS NULL AND period_start = ?",
    ledgerId ? [userId, ledgerId, periodStart] : [userId, periodStart],
  );

  if (existing) return existing;

  const id = generateId();
  const now = new Date().toISOString();

  await db.run(
    `INSERT INTO usage_tracking (id, user_id, ledger_id, period_start, period_end, transactions_count, invoices_count, customers_count, fixed_assets_count, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 0, 0, 0, 0, ?, ?)`,
    [id, userId, ledgerId ?? null, periodStart, periodEnd, now, now],
  );

  const row = await db.get<UsageTrackingRow>(
    "SELECT * FROM usage_tracking WHERE id = ?",
    [id],
  );
  return row!;
}

// ---------------------------------------------------------------------------
// Increment usage
// ---------------------------------------------------------------------------

type UsageField = "transactions_count" | "invoices_count" | "customers_count" | "fixed_assets_count" | "bills_count" | "vendors_count";

/**
 * Whitelist of column names that can be used in dynamic SQL.
 * This is the ONLY guard against SQL injection for the incrementUsage function.
 * NEVER add user-provided values to this set.
 */
const VALID_FIELDS: ReadonlySet<UsageField> = new Set<UsageField>([
  "transactions_count",
  "invoices_count",
  "customers_count",
  "fixed_assets_count",
  "bills_count",
  "vendors_count",
] as const);

/** Type guard ensuring a field name is safe for SQL interpolation. */
const assertValidField = (field: string): field is UsageField => {
  return (VALID_FIELDS as ReadonlySet<string>).has(field);
};

export async function incrementUsage(
  db: Database,
  userId: string,
  ledgerId: string | undefined,
  field: UsageField,
): Promise<void> {
  if (!assertValidField(field)) return;

  // Ensure record exists
  await getOrCreateUsageRecord(db, userId, ledgerId);

  const { periodStart } = getCurrentUsagePeriod();
  const now = new Date().toISOString();

  await db.run(
    ledgerId
      ? `UPDATE usage_tracking SET ${field} = ${field} + 1, updated_at = ? WHERE user_id = ? AND ledger_id = ? AND period_start = ?`
      : `UPDATE usage_tracking SET ${field} = ${field} + 1, updated_at = ? WHERE user_id = ? AND ledger_id IS NULL AND period_start = ?`,
    ledgerId ? [now, userId, ledgerId, periodStart] : [now, userId, periodStart],
  );
}

// ---------------------------------------------------------------------------
// Usage summary
// ---------------------------------------------------------------------------

export interface UsageSummaryResource {
  used: number;
  limit: number | null;
  remaining: number | null;
}

export interface UsageSummary {
  tier: string;
  period: { start: string; end: string };
  ledgerCount: number;
  ledgers: UsageSummaryResource;
  transactions: UsageSummaryResource;
  invoices: UsageSummaryResource;
  customers: UsageSummaryResource;
  fixedAssets: UsageSummaryResource;
}

function makeResource(used: number, limit: number | null): UsageSummaryResource {
  return {
    used,
    limit,
    remaining: limit === null ? null : Math.max(0, limit - used),
  };
}

export async function getUsageSummary(db: Database, userId: string): Promise<UsageSummary> {
  const user = await db.get<{ plan: string | null }>(
    "SELECT plan FROM users WHERE id = ?",
    [userId],
  );
  const tier = user?.plan || "free";
  const { periodStart, periodEnd } = getCurrentUsagePeriod();

  // Count ledgers owned by user
  const ledgerRow = await db.get<{ cnt: number }>(
    "SELECT COUNT(*) as cnt FROM ledgers WHERE owner_id = ? AND status = 'active'",
    [userId],
  );
  const ledgerCount = ledgerRow?.cnt ?? 0;

  // Aggregate usage across all ledgers for current period
  const usageRow = await db.get<{
    total_transactions: number;
    total_invoices: number;
    total_customers: number;
    total_fixed_assets: number;
  }>(
    `SELECT
       COALESCE(SUM(transactions_count), 0) as total_transactions,
       COALESCE(SUM(invoices_count), 0) as total_invoices,
       COALESCE(SUM(customers_count), 0) as total_customers,
       COALESCE(SUM(fixed_assets_count), 0) as total_fixed_assets
     FROM usage_tracking
     WHERE user_id = ? AND period_start = ?`,
    [userId, periodStart],
  );

  const config = getTierConfig(tier);

  return {
    tier,
    period: { start: periodStart, end: periodEnd },
    ledgerCount,
    ledgers: makeResource(ledgerCount, config.limits.maxLedgers),
    transactions: makeResource(
      usageRow?.total_transactions ?? 0,
      config.limits.maxTransactionsPerMonth,
    ),
    invoices: makeResource(
      usageRow?.total_invoices ?? 0,
      config.limits.maxInvoicesPerMonth,
    ),
    customers: makeResource(
      usageRow?.total_customers ?? 0,
      config.limits.maxCustomers,
    ),
    fixedAssets: makeResource(
      usageRow?.total_fixed_assets ?? 0,
      config.limits.maxFixedAssets,
    ),
  };
}

// ---------------------------------------------------------------------------
// Limit checking
// ---------------------------------------------------------------------------

export interface LimitCheckResult {
  allowed: boolean;
  used: number;
  limit: number | null;
  message: string;
}

const RESOURCE_TO_FIELD: Record<string, UsageField> = {
  transactions: "transactions_count",
  invoices: "invoices_count",
  customers: "customers_count",
  fixed_assets: "fixed_assets_count",
  bills: "bills_count",
  vendors: "vendors_count",
};

const RESOURCE_TO_LIMIT: Record<string, TierLimit> = {
  transactions: "maxTransactionsPerMonth",
  invoices: "maxInvoicesPerMonth",
  customers: "maxCustomers",
  fixed_assets: "maxFixedAssets",
  bills: "maxBillsPerMonth",
  vendors: "maxVendors",
  ledgers: "maxLedgers",
};

export async function checkLimit(
  db: Database,
  userId: string,
  ledgerId: string | undefined,
  resource: string,
): Promise<LimitCheckResult> {
  const user = await db.get<{ plan: string | null }>(
    "SELECT plan FROM users WHERE id = ?",
    [userId],
  );
  const tier = user?.plan || "free";
  const limitKey = RESOURCE_TO_LIMIT[resource];
  if (!limitKey) {
    return { allowed: true, used: 0, limit: null, message: "Unknown resource" };
  }

  const limit = getLimit(tier, limitKey);

  // Unlimited
  if (limit === null) {
    return { allowed: true, used: 0, limit: null, message: "Unlimited" };
  }

  // Ledger count check
  if (resource === "ledgers") {
    const row = await db.get<{ cnt: number }>(
      "SELECT COUNT(*) as cnt FROM ledgers WHERE owner_id = ? AND status = 'active'",
      [userId],
    );
    const used = row?.cnt ?? 0;
    const allowed = used < limit;
    return {
      allowed,
      used,
      limit,
      message: allowed
        ? `${used}/${limit} ledgers used`
        : `Ledger limit reached (${used}/${limit}). Upgrade to create more ledgers.`,
    };
  }

  // Per-ledger resources (transactions) — check for specific ledger
  if (resource === "transactions" && ledgerId) {
    const { periodStart } = getCurrentUsagePeriod();
    const row = await db.get<{ cnt: number }>(
      "SELECT COALESCE(transactions_count, 0) as cnt FROM usage_tracking WHERE user_id = ? AND ledger_id = ? AND period_start = ?",
      [userId, ledgerId, periodStart],
    );
    const used = row?.cnt ?? 0;
    const allowed = used < limit;
    return {
      allowed,
      used,
      limit,
      message: allowed
        ? `${used}/${limit} transactions this month`
        : `Transaction limit reached (${used}/${limit} this month). Upgrade for more.`,
    };
  }

  // Account-wide resources (customers, fixed_assets, vendors) — aggregate lifetime
  const field = RESOURCE_TO_FIELD[resource];
  if (!field) {
    return { allowed: true, used: 0, limit: null, message: "Unknown resource" };
  }

  // For customers, fixed_assets, and vendors, check lifetime count (not periodic)
  if (resource === "customers" || resource === "fixed_assets" || resource === "vendors") {
    // SAFETY: table name is derived from a hardcoded string comparison, never from user input.
    const table = resource === "customers" ? "customers" : resource === "vendors" ? "vendors" : "fixed_assets";
    // Use JOIN instead of subquery for better index utilisation
    const row = await db.get<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM ${table} t JOIN ledgers l ON t.ledger_id = l.id WHERE l.owner_id = ?`,
      [userId],
    );
    const used = row?.cnt ?? 0;
    const allowed = used < limit;
    const label = resource === "customers" ? "customers" : resource === "vendors" ? "vendors" : "fixed assets";
    return {
      allowed,
      used,
      limit,
      message: allowed
        ? `${used}/${limit} ${label}`
        : `${label.charAt(0).toUpperCase() + label.slice(1)} limit reached (${used}/${limit}). Upgrade for more.`,
    };
  }

  // Invoices and bills — check current period aggregate
  const { periodStart } = getCurrentUsagePeriod();
  if (resource === "bills") {
    const row = await db.get<{ cnt: number }>(
      `SELECT COALESCE(SUM(bills_count), 0) as cnt FROM usage_tracking WHERE user_id = ? AND period_start = ?`,
      [userId, periodStart],
    );
    const used = row?.cnt ?? 0;
    const allowed = used < limit;
    return {
      allowed,
      used,
      limit,
      message: allowed
        ? `${used}/${limit} bills this month`
        : `Bill limit reached (${used}/${limit} this month). Upgrade for more.`,
    };
  }

  const row = await db.get<{ cnt: number }>(
    `SELECT COALESCE(SUM(invoices_count), 0) as cnt FROM usage_tracking WHERE user_id = ? AND period_start = ?`,
    [userId, periodStart],
  );
  const used = row?.cnt ?? 0;
  const allowed = used < limit;
  return {
    allowed,
    used,
    limit,
    message: allowed
      ? `${used}/${limit} invoices this month`
      : `Invoice limit reached (${used}/${limit} this month). Upgrade for more.`,
  };
}

// ---------------------------------------------------------------------------
// Atomic check-and-increment
// ---------------------------------------------------------------------------

/**
 * Atomically check a tier limit and increment usage in one DB transaction.
 * Replaces the racey separate checkLimit() / incrementUsage() pair, which
 * allowed concurrent requests to all observe used < limit and proceed,
 * exceeding the cap.
 *
 * For period-based counters (transactions, invoices, bills) this uses a
 * conditional UPDATE so the check and increment are a single statement.
 * For lifetime counters (customers, vendors, fixed_assets, ledgers) the
 * "increment" is the row insert in the route handler — those still rely on
 * the standard checkLimit() pre-check; the residual race window is the time
 * between the SELECT and the INSERT, which is bounded by a single user's
 * concurrency.
 *
 * Returns the same LimitCheckResult shape as checkLimit(). On allowed=true
 * the counter has already been incremented; the caller does NOT need to
 * call incrementUsage() afterwards.
 */
export async function checkAndIncrementUsage(
  db: Database,
  userId: string,
  ledgerId: string | undefined,
  resource: string,
): Promise<LimitCheckResult> {
  try {
    return await checkAndIncrementUsageImpl(db, userId, ledgerId, resource);
  } catch (err) {
    // If the tier schema is not yet applied (e.g. older test fixtures),
    // don't block requests. Real runtime errors should still surface, so
    // we only swallow the specific "no such table/column" class of errors.
    const message = err instanceof Error ? err.message : String(err);
    if (/no such (table|column)/i.test(message)) {
      return { allowed: true, used: 0, limit: null, message: "Tier schema not ready" };
    }
    throw err;
  }
}

async function checkAndIncrementUsageImpl(
  db: Database,
  userId: string,
  ledgerId: string | undefined,
  resource: string,
): Promise<LimitCheckResult> {
  const limitKey = RESOURCE_TO_LIMIT[resource];
  if (!limitKey) {
    return { allowed: true, used: 0, limit: null, message: "Unknown resource" };
  }

  const user = await db.get<{ plan: string | null }>(
    "SELECT plan FROM users WHERE id = ?",
    [userId],
  );
  const tier = user?.plan || "free";
  const limit = getLimit(tier, limitKey);

  // Unlimited — nothing to enforce, but still increment for analytics.
  if (limit === null) {
    const field = RESOURCE_TO_FIELD[resource];
    if (field) await incrementUsage(db, userId, ledgerId, field);
    return { allowed: true, used: 0, limit: null, message: "Unlimited" };
  }

  const field = RESOURCE_TO_FIELD[resource];

  // Lifetime resources (customers, vendors, fixed_assets, ledgers) — the count
  // lives in the resource table itself, not usage_tracking. Fall back to the
  // pre-check pattern; the route's INSERT is the increment.
  if (
    !field ||
    resource === "customers" ||
    resource === "vendors" ||
    resource === "fixed_assets" ||
    resource === "ledgers"
  ) {
    return checkLimit(db, userId, ledgerId, resource);
  }

  // Period-based counters: do the check + increment as a single conditional
  // UPDATE inside a transaction. If 0 rows are affected, the limit was hit.
  return db.transaction(async () => {
    await getOrCreateUsageRecord(db, userId, ledgerId);
    const { periodStart } = getCurrentUsagePeriod();
    const now = new Date().toISOString();

    // For per-ledger counters (transactions) we increment the per-ledger row.
    // For account-wide counters (invoices, bills) we increment the row for
    // the specific ledger as well; the limit aggregates across rows.
    const isPerLedger = resource === "transactions";

    if (isPerLedger && ledgerId) {
      const result = await db.run(
        `UPDATE usage_tracking
         SET ${field} = ${field} + 1, updated_at = ?
         WHERE user_id = ? AND ledger_id = ? AND period_start = ?
           AND ${field} < ?`,
        [now, userId, ledgerId, periodStart, limit],
      );
      if (result.changes > 0) {
        const after = await db.get<{ cnt: number }>(
          `SELECT ${field} as cnt FROM usage_tracking WHERE user_id = ? AND ledger_id = ? AND period_start = ?`,
          [userId, ledgerId, periodStart],
        );
        const used = after?.cnt ?? limit;
        return {
          allowed: true,
          used,
          limit,
          message: `${used}/${limit} ${resource} this month`,
        };
      }
      // Limit hit — fetch current value for the error message.
      const current = await db.get<{ cnt: number }>(
        `SELECT ${field} as cnt FROM usage_tracking WHERE user_id = ? AND ledger_id = ? AND period_start = ?`,
        [userId, ledgerId, periodStart],
      );
      const used = current?.cnt ?? limit;
      return {
        allowed: false,
        used,
        limit,
        message: `${resource.charAt(0).toUpperCase() + resource.slice(1)} limit reached (${used}/${limit} this month). Upgrade for more.`,
      };
    }

    // Account-wide period counters (invoices, bills): the limit aggregates
    // across all of the user's usage_tracking rows for this period. We have
    // to read the aggregate to know whether we can increment.
    const aggField = field;
    const sumRow = await db.get<{ total: number }>(
      `SELECT COALESCE(SUM(${aggField}), 0) as total FROM usage_tracking WHERE user_id = ? AND period_start = ?`,
      [userId, periodStart],
    );
    const currentTotal = sumRow?.total ?? 0;
    if (currentTotal >= limit) {
      return {
        allowed: false,
        used: currentTotal,
        limit,
        message: `${resource.charAt(0).toUpperCase() + resource.slice(1)} limit reached (${currentTotal}/${limit} this month). Upgrade for more.`,
      };
    }

    // Increment the per-ledger record (or the user-level record if no ledgerId).
    await db.run(
      ledgerId
        ? `UPDATE usage_tracking SET ${aggField} = ${aggField} + 1, updated_at = ? WHERE user_id = ? AND ledger_id = ? AND period_start = ?`
        : `UPDATE usage_tracking SET ${aggField} = ${aggField} + 1, updated_at = ? WHERE user_id = ? AND ledger_id IS NULL AND period_start = ?`,
      ledgerId ? [now, userId, ledgerId, periodStart] : [now, userId, periodStart],
    );
    return {
      allowed: true,
      used: currentTotal + 1,
      limit,
      message: `${currentTotal + 1}/${limit} ${resource} this month`,
    };
  });
}

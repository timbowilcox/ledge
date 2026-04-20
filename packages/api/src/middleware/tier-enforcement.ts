// ---------------------------------------------------------------------------
// Tier enforcement middleware — composable gates and limit checks.
//
// Usage:
//   tierFeatureGate('pdfExport')     — blocks if user's tier lacks the feature
//   tierLimitCheck('transactions')   — blocks if user has hit the usage limit
//   tierUsageIncrement('transactions') — increments counter after successful response
//   tierApiAccessGate()              — blocks free-tier API key access
// ---------------------------------------------------------------------------

import { createMiddleware } from "hono/factory";
import type { Env } from "../lib/context.js";
import {
  hasFeature,
  checkAndIncrementUsage,
  incrementUsage,
} from "@kounta/core";
import type { TierFeature } from "@kounta/core";

const DASHBOARD_URL = process.env["NEXT_PUBLIC_APP_URL"] || "https://kounta.ai";
const UPGRADE_URL = `${DASHBOARD_URL}/billing`;

// ---------------------------------------------------------------------------
// Feature gate — checks if a tier feature is enabled
// ---------------------------------------------------------------------------

export const tierFeatureGate = (feature: TierFeature) =>
  createMiddleware<Env>(async (c, next) => {
    const engine = c.get("engine");
    const apiKeyInfo = c.get("apiKeyInfo");
    if (!apiKeyInfo) {
      await next();
      return;
    }

    const userResult = await engine.getUserByLedger(apiKeyInfo.ledgerId);
    if (!userResult.ok) {
      await next();
      return;
    }

    const tier = userResult.value.plan || "free";
    if (!hasFeature(tier, feature)) {
      return c.json(
        {
          error: {
            code: "FORBIDDEN",
            message: `This feature requires a higher tier. Your current plan: ${tier}.`,
            details: [
              {
                field: "tier",
                actual: tier,
                suggestion: `Upgrade your plan to access this feature.`,
              },
            ],
            upgrade_url: UPGRADE_URL,
            requestId: c.get("requestId"),
          },
        },
        403,
      );
    }

    await next();
  });

// ---------------------------------------------------------------------------
// API access gate — blocks free-tier users from API key access
// ---------------------------------------------------------------------------

export const tierApiAccessGate = () =>
  createMiddleware<Env>(async (c, next) => {
    const engine = c.get("engine");
    const apiKeyInfo = c.get("apiKeyInfo");
    if (!apiKeyInfo) {
      await next();
      return;
    }

    // Only gate API key access (not dashboard sessions via admin auth)
    const rawKey = c.req.header("Authorization")?.slice(7) ?? c.req.header("X-Api-Key");
    if (!rawKey?.startsWith("kounta_live_") && !rawKey?.startsWith("kounta_test_")) {
      await next();
      return;
    }

    const userResult = await engine.getUserByLedger(apiKeyInfo.ledgerId);
    if (!userResult.ok) {
      await next();
      return;
    }

    const tier = userResult.value.plan || "free";
    if (!hasFeature(tier, "apiAccess")) {
      return c.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "API access requires Builder tier or above",
            details: [
              {
                field: "tier",
                actual: tier,
                suggestion: "Upgrade to Builder ($19/month) to use the API and SDK.",
              },
            ],
            upgrade_url: UPGRADE_URL,
            requestId: c.get("requestId"),
          },
        },
        403,
      );
    }

    await next();
  });

// ---------------------------------------------------------------------------
// Atomic limit check + increment — closes the race window where concurrent
// requests could each see used < limit and all proceed past the cap.
//
// For period-based counters (transactions, invoices, bills) the increment
// happens INSIDE the check transaction, so by the time this middleware
// returns the counter has already been bumped. Routes that use this gate
// should NOT also call tierUsageIncrement for the same resource — the new
// behaviour is "atomic" rather than "check now, increment later".
//
// For lifetime resources (customers, vendors, fixed_assets, ledgers) the
// increment is the route's INSERT, so this middleware delegates to the
// non-atomic checkLimit() — the race window is bounded by per-user
// concurrency and accepted as residual.
//
// On failure (DB error, table not migrated), we LOG and fail closed rather
// than fail open — accidentally granting unlimited access on a tier-system
// outage is a billing leak, not a safe default.
// ---------------------------------------------------------------------------

export const tierLimitCheck = (resource: string) =>
  createMiddleware<Env>(async (c, next) => {
    const engine = c.get("engine");
    const apiKeyInfo = c.get("apiKeyInfo");
    if (!apiKeyInfo) {
      await next();
      return;
    }

    const db = engine.getDb();
    let result;
    try {
      result = await checkAndIncrementUsage(db, apiKeyInfo.userId, apiKeyInfo.ledgerId, resource);
    } catch (err) {
      console.error(`[tier] checkAndIncrementUsage failed for resource=${resource}:`, err);
      return c.json(
        {
          error: {
            code: "INTERNAL_ERROR",
            message: "Could not verify plan limits. Please retry.",
            requestId: c.get("requestId"),
          },
        },
        500,
      );
    }

    if (!result.allowed) {
      return c.json(
        {
          error: {
            code: "PLAN_LIMIT_EXCEEDED",
            message: result.message,
            details: [
              {
                field: resource,
                actual: String(result.used),
                expected: String(result.limit),
                suggestion: `Upgrade your plan for higher limits.`,
              },
            ],
            limit: result.limit,
            used: result.used,
            tier: (await db.get<{ plan: string | null }>("SELECT plan FROM users WHERE id = ?", [apiKeyInfo.userId]))?.plan || "free",
            upgrade_url: UPGRADE_URL,
            requestId: c.get("requestId"),
          },
        },
        429,
      );
    }

    await next();

    // If the route handler failed (4xx/5xx response), roll back the increment
    // for period-based counters. Lifetime counters never incremented in the
    // middleware (the route's INSERT did), so there's nothing to undo.
    const status = c.res.status;
    if (status >= 400 && resource !== "customers" && resource !== "vendors" && resource !== "fixed_assets" && resource !== "ledgers") {
      try {
        const RESOURCE_TO_FIELD_LOCAL: Record<string, "transactions_count" | "invoices_count" | "bills_count"> = {
          transactions: "transactions_count",
          invoices: "invoices_count",
          bills: "bills_count",
        };
        const field = RESOURCE_TO_FIELD_LOCAL[resource];
        if (field) {
          await db.run(
            apiKeyInfo.ledgerId
              ? `UPDATE usage_tracking SET ${field} = MAX(${field} - 1, 0) WHERE user_id = ? AND ledger_id = ?`
              : `UPDATE usage_tracking SET ${field} = MAX(${field} - 1, 0) WHERE user_id = ? AND ledger_id IS NULL`,
            apiKeyInfo.ledgerId ? [apiKeyInfo.userId, apiKeyInfo.ledgerId] : [apiKeyInfo.userId],
          );
        }
      } catch (err) {
        console.error(`[tier] failed to roll back increment after ${status}:`, err);
      }
    }
  });

// ---------------------------------------------------------------------------
// Usage increment — increments counter after a successful write
// ---------------------------------------------------------------------------

type UsageField = "transactions_count" | "invoices_count" | "customers_count" | "fixed_assets_count";

const RESOURCE_TO_FIELD: Record<string, UsageField> = {
  transactions: "transactions_count",
  invoices: "invoices_count",
  customers: "customers_count",
  fixed_assets: "fixed_assets_count",
};

export const tierUsageIncrement = (resource: string) =>
  createMiddleware<Env>(async (c, next) => {
    await next();

    // Only increment on successful writes (2xx responses)
    const status = c.res.status;
    if (status < 200 || status >= 300) return;

    const engine = c.get("engine");
    const apiKeyInfo = c.get("apiKeyInfo");
    if (!apiKeyInfo) return;

    const field = RESOURCE_TO_FIELD[resource];
    if (!field) return;

    try {
      await incrementUsage(
        engine.getDb(),
        apiKeyInfo.userId,
        apiKeyInfo.ledgerId,
        field,
      );
    } catch {
      // Non-critical — don't fail the request if usage tracking fails
    }
  });

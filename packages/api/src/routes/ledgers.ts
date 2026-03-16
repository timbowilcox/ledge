// ---------------------------------------------------------------------------
// Ledger routes — /v1/ledgers
// ---------------------------------------------------------------------------

import { Hono } from "hono";
import type { Env } from "../lib/context.js";
import { adminAuth, apiKeyAuth } from "../middleware/auth.js";
import { errorResponse, created, success } from "../lib/responses.js";
import { checkLimit } from "@kounta/core";

export const ledgerRoutes = new Hono<Env>();

/** POST /v1/ledgers — Create a new ledger (admin auth required) */
ledgerRoutes.post("/", adminAuth, async (c) => {
  const engine = c.get("engine");
  const body = await c.req.json();

  // The apiKeyInfo is set for API-key auth; for admin secret auth it won't be set.
  // For ledger creation via admin secret, ownerId must be provided in the body.
  const apiKeyInfo = c.get("apiKeyInfo");
  const ownerId = body.ownerId ?? apiKeyInfo?.userId;

  if (!ownerId) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "ownerId is required",
          details: [
            {
              field: "ownerId",
              suggestion:
                "Provide an ownerId in the request body. This should be the UUID of the user who owns the ledger.",
            },
          ],
          requestId: c.get("requestId"),
        },
      },
      400
    );
  }

  // Check ledger limit for the owner
  try {
    const limitCheck = await checkLimit(engine.getDb(), ownerId, undefined, "ledgers");
    if (!limitCheck.allowed) {
      return c.json(
        {
          error: {
            code: "PLAN_LIMIT_EXCEEDED",
            message: limitCheck.message,
            details: [{ field: "ledgers", actual: String(limitCheck.used), expected: String(limitCheck.limit) }],
            limit: limitCheck.limit,
            used: limitCheck.used,
            upgrade_url: (process.env["NEXT_PUBLIC_APP_URL"] || "https://kounta.ai") + "/billing",
            requestId: c.get("requestId"),
          },
        },
        403,
      );
    }
  } catch { /* fail open if tier check unavailable */ }

  const result = await engine.createLedger({
    name: body.name,
    currency: body.currency,
    fiscalYearStart: body.fiscalYearStart,
    accountingBasis: body.accountingBasis,
    ownerId,
    businessContext: body.businessContext,
  });

  if (!result.ok) {
    return errorResponse(c, result.error);
  }

  return created(c, result.value);
});

/** GET /v1/ledgers — List all ledgers owned by the authenticated user */
ledgerRoutes.get("/", apiKeyAuth, async (c) => {
  const engine = c.get("engine");
  const apiKeyInfo = c.get("apiKeyInfo");
  if (!apiKeyInfo?.userId) {
    return c.json({ error: { code: "UNAUTHORIZED", message: "No user context", details: [], requestId: c.get("requestId") } }, 401);
  }

  // Use direct DB query to include jurisdiction column
  const db = engine.getDb();
  const rows = await db.all<{
    id: string;
    name: string;
    currency: string;
    template_id: string | null;
    jurisdiction: string;
    fiscal_year_start: number;
    accounting_basis: string;
    status: string;
    created_at: string;
  }>(
    "SELECT id, name, currency, template_id, jurisdiction, fiscal_year_start, accounting_basis, status, created_at FROM ledgers WHERE owner_id = ? AND status = 'active' ORDER BY created_at ASC",
    [apiKeyInfo.userId],
  );

  const ledgers = rows.map((r) => ({
    id: r.id,
    name: r.name,
    currency: r.currency,
    templateId: r.template_id,
    jurisdiction: r.jurisdiction ?? "AU",
    fiscalYearStart: r.fiscal_year_start,
    accountingBasis: r.accounting_basis,
    status: r.status,
    createdAt: r.created_at,
  }));

  return success(c, ledgers);
});

/** GET /v1/ledgers/:ledgerId — Get a ledger (API key auth required) */
ledgerRoutes.get("/:ledgerId", apiKeyAuth, async (c) => {
  const engine = c.get("engine");
  const ledgerId = c.req.param("ledgerId");

  const result = await engine.getLedger(ledgerId);
  if (!result.ok) {
    return errorResponse(c, result.error);
  }

  return success(c, result.value);
});

/** PATCH /v1/ledgers/:ledgerId — Update ledger settings (API key auth required) */
ledgerRoutes.patch("/:ledgerId", apiKeyAuth, async (c) => {
  const engine = c.get("engine");
  const ledgerId = c.req.param("ledgerId");
  const body = await c.req.json();

  const result = await engine.updateLedger(ledgerId, {
    name: body.name,
    fiscalYearStart: body.fiscalYearStart,
  });

  if (!result.ok) {
    return errorResponse(c, result.error);
  }

  return success(c, result.value);
});

/** DELETE /v1/ledgers/:ledgerId — Soft-delete a ledger (admin auth required) */
ledgerRoutes.delete("/:ledgerId", adminAuth, async (c) => {
  const engine = c.get("engine");
  const db = engine.getDb();
  const ledgerId = c.req.param("ledgerId");
  const body = await c.req.json().catch(() => ({})) as { userId?: string };

  const userId = body.userId ?? c.get("apiKeyInfo")?.userId;
  if (!userId) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "userId is required", details: [], requestId: c.get("requestId") } }, 400);
  }

  // Verify the user owns this ledger
  const ledgerResult = await engine.getLedger(ledgerId);
  if (!ledgerResult.ok) {
    return errorResponse(c, ledgerResult.error);
  }
  if ((ledgerResult.value as any).ownerId !== userId) {
    return c.json({ error: { code: "FORBIDDEN", message: "User does not own this ledger", details: [], requestId: c.get("requestId") } }, 403);
  }

  // Cannot delete the user's only remaining ledger
  const ledgersResult = await engine.findLedgersByOwner(userId);
  if (ledgersResult.ok && ledgersResult.value.length <= 1) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "Cannot delete your only ledger", details: [{ field: "ledgerId", suggestion: "You must have at least one ledger." }], requestId: c.get("requestId") } }, 400);
  }

  // Soft-delete: set status to 'deleted'
  const now = new Date().toISOString();
  await db.run("UPDATE ledgers SET status = 'deleted', updated_at = ? WHERE id = ?", [now, ledgerId]);

  // Revoke all API keys for this ledger
  const keysResult = await engine.listApiKeys(ledgerId);
  if (keysResult.ok) {
    for (const key of keysResult.value) {
      if (key.status === "active") {
        await engine.revokeApiKey(key.id);
      }
    }
  }

  return success(c, { id: ledgerId, status: "deleted" });
});

/** GET /v1/ledgers/:ledgerId/jurisdiction — Get jurisdiction settings */
ledgerRoutes.get("/:ledgerId/jurisdiction", apiKeyAuth, async (c) => {
  const db = c.get("engine").getDb();
  const ledgerId = c.req.param("ledgerId");

  const row = await db.get<{ jurisdiction: string; tax_id: string | null; tax_basis: string; fiscal_year_start: number }>(
    "SELECT jurisdiction, tax_id, tax_basis, fiscal_year_start FROM ledgers WHERE id = ?",
    [ledgerId],
  );

  return success(c, {
    jurisdiction: row?.jurisdiction ?? "AU",
    taxId: row?.tax_id ?? null,
    taxBasis: row?.tax_basis ?? "accrual",
    fiscalYearStart: row?.fiscal_year_start ?? 1,
  });
});

/** PATCH /v1/ledgers/:ledgerId/jurisdiction — Update jurisdiction settings */
ledgerRoutes.patch("/:ledgerId/jurisdiction", adminAuth, async (c) => {
  const db = c.get("engine").getDb();
  const ledgerId = c.req.param("ledgerId");
  const body = await c.req.json() as {
    jurisdiction?: string;
    taxId?: string | null;
    taxBasis?: string;
  };

  const sets: string[] = [];
  const params: unknown[] = [];

  if (body.jurisdiction !== undefined) {
    sets.push("jurisdiction = ?");
    params.push(body.jurisdiction);
  }
  if (body.taxId !== undefined) {
    sets.push("tax_id = ?");
    params.push(body.taxId);
  }
  if (body.taxBasis !== undefined) {
    sets.push("tax_basis = ?");
    params.push(body.taxBasis);
  }

  if (sets.length === 0) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "No fields to update", details: [] } }, 400);
  }

  sets.push("updated_at = ?");
  params.push(new Date().toISOString());
  params.push(ledgerId);

  await db.run(`UPDATE ledgers SET ${sets.join(", ")} WHERE id = ?`, params);

  // Return updated jurisdiction data
  const row = await db.get<{ jurisdiction: string; tax_id: string | null; tax_basis: string }>(
    "SELECT jurisdiction, tax_id, tax_basis FROM ledgers WHERE id = ?",
    [ledgerId],
  );

  return success(c, {
    jurisdiction: row?.jurisdiction ?? "AU",
    taxId: row?.tax_id ?? null,
    taxBasis: row?.tax_basis ?? "accrual",
  });
});

// ---------------------------------------------------------------------------
// Transaction routes — /v1/ledgers/:ledgerId/transactions
// ---------------------------------------------------------------------------

import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../lib/context.js";
import { apiKeyAuth } from "../middleware/auth.js";
import { errorResponse, created, success, paginated } from "../lib/responses.js";
import { validateBody, parseBoundedInt } from "../lib/validate.js";
import {
  getJurisdictionConfig,
  postLineSchema,
  sourceType,
  isoDate,
} from "@kounta/core";

const DASHBOARD_URL = process.env["NEXT_PUBLIC_APP_URL"] || "https://kounta.ai";
const UPGRADE_URL = `${DASHBOARD_URL}/billing`;

export const transactionRoutes = new Hono<Env>();

// All transaction routes require API key auth
transactionRoutes.use("/*", apiKeyAuth);

// Schema for transaction creation (validated at boundary)
const createTransactionBodySchema = z.object({
  date: isoDate,
  effectiveDate: isoDate.optional(),
  memo: z.string().min(1).max(1000),
  lines: z.array(postLineSchema).min(2),
  idempotencyKey: z.string().max(255).optional(),
  sourceType: sourceType.optional(),
  sourceRef: z.string().max(500).optional(),
  agentId: z.string().max(255).optional(),
  metadata: z.record(z.unknown()).optional(),
});

/** POST /v1/ledgers/:ledgerId/transactions — Post a new transaction */
transactionRoutes.post("/", async (c) => {
  const engine = c.get("engine");
  const ledgerId = c.req.param("ledgerId");
  const body = await validateBody(c, createTransactionBodySchema);
  if (body instanceof Response) return body;

  // Support Idempotency-Key header as an alternative to body field
  const headerKey = c.req.header("Idempotency-Key");
  const idempotencyKey = body.idempotencyKey ?? headerKey;

  // Tier-based usage limit check — atomic check + increment.
  // Failures fail closed (500) rather than fail open: we can't risk granting
  // unlimited posts when the tier system is unhealthy.
  let tierUsed = 0;
  let tierLimit: number | null = null;
  let tierIncremented = false;
  const apiKeyInfo = c.get("apiKeyInfo");
  if (apiKeyInfo) {
    let tierCheck;
    try {
      tierCheck = await engine.checkAndIncrementUsage(apiKeyInfo.userId, ledgerId!, "transactions");
    } catch (err) {
      console.error("[tier] checkAndIncrementUsage failed:", err);
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
    tierUsed = tierCheck.used;
    tierLimit = tierCheck.limit;
    if (!tierCheck.allowed) {
      c.header("X-Kounta-Usage", `${tierCheck.used}/${tierCheck.limit ?? "unlimited"}`);
      return c.json(
        {
          error: {
            code: "PLAN_LIMIT_EXCEEDED",
            message: tierCheck.message,
            details: [{ field: "transactions", actual: String(tierCheck.used), expected: String(tierCheck.limit) }],
            limit: tierCheck.limit,
            used: tierCheck.used,
            upgrade_url: UPGRADE_URL,
            requestId: c.get("requestId"),
          },
        },
        429,
      );
    }
    tierIncremented = true;
  }

  const statusOverride: "posted" | "pending" | undefined = undefined;

  const result = await engine.postTransaction({
    ledgerId: ledgerId!,
    date: body.date,
    effectiveDate: body.effectiveDate,
    memo: body.memo,
    lines: body.lines,
    idempotencyKey,
    sourceType: body.sourceType ?? "api",
    sourceRef: body.sourceRef,
    agentId: body.agentId,
    metadata: body.metadata,
    statusOverride,
  });

  if (!result.ok) {
    // Roll back the atomic pre-increment so a failed post doesn't burn a quota slot.
    if (tierIncremented && apiKeyInfo) {
      try {
        const db = engine.getDb();
        await db.run(
          "UPDATE usage_tracking SET transactions_count = MAX(transactions_count - 1, 0) WHERE user_id = ? AND ledger_id = ?",
          [apiKeyInfo.userId, ledgerId!],
        );
      } catch (err) {
        console.error("[tier] failed to roll back transactions_count after error:", err);
      }
    }
    return errorResponse(c, result.error);
  }
  // Usage already incremented atomically by checkAndIncrementUsage above.

  // Receipt prompt — notify for expenses over $75 (7500 cents)
  try {
    const RECEIPT_THRESHOLD = 7500;
    const tx = result.value;
    const expenseDebits = tx.lines.filter((l) => l.direction === "debit" && l.amount >= RECEIPT_THRESHOLD);
    if (expenseDebits.length > 0) {
      // Check if any debit line targets an expense account
      for (const line of expenseDebits) {
        const acctResult = await engine.getAccount(line.accountId);
        if (acctResult.ok && acctResult.value.type === "expense") {
          const apiKeyInfo = c.get("apiKeyInfo");
          if (apiKeyInfo) {
            const amountDisplay = `$${(line.amount / 100).toFixed(2)}`;
            await engine.createNotification({
              ledgerId: ledgerId!,
              userId: apiKeyInfo.userId,
              type: "receipt_prompt",
              severity: "info",
              title: `Attach receipt for ${amountDisplay} expense`,
              body: `Transaction "${tx.memo}" includes a ${amountDisplay} expense. Consider attaching a receipt for audit readiness.`,
              data: { transactionId: tx.id, accountId: line.accountId, amount: line.amount },
              actionType: "attach_receipt",
              actionData: { transactionId: tx.id },
            });
          }
          break; // One notification per transaction
        }
      }
    }
  } catch { /* Receipt prompt is best-effort — never block transaction creation */ }

  // Capitalisation check — notify when large expenses may need to be capitalised
  try {
    const tx = result.value;

    // Skip depreciation entries (posted by the depreciation scheduler)
    const isDepreciation = tx.idempotencyKey?.startsWith("depreciation-") || tx.memo?.startsWith("Depreciation:");

    // Skip transactions linked to recurring entries
    const isRecurring = await engine.isRecurringTransaction(tx.id);

    if (!isDepreciation && !isRecurring) {
      // Account name keywords to exclude (legitimate recurring large expenses)
      const EXCLUDE_KEYWORDS = /\b(rent|insurance|subscription|lease|payroll|salary|wages|tax|utilities)\b/i;

      // Get jurisdiction config for threshold
      const jurResult = await engine.getLedgerJurisdiction(ledgerId!);
      const jurisdiction = jurResult.ok ? jurResult.value.jurisdiction : "AU";
      const jConfig = getJurisdictionConfig(jurisdiction);
      const threshold = jConfig.capitalisationThreshold;

      if (threshold > 0) {
        // Find expense debits exceeding the threshold
        const expenseDebits = tx.lines.filter((l) => l.direction === "debit" && l.amount >= threshold);
        for (const line of expenseDebits) {
          const acctResult = await engine.getAccount(line.accountId);
          if (!acctResult.ok || acctResult.value.type !== "expense") continue;

          // Skip accounts with excluded keywords in the name
          if (EXCLUDE_KEYWORDS.test(acctResult.value.name)) continue;

          const apiKeyInfo = c.get("apiKeyInfo");
          if (!apiKeyInfo) break;

          const amountDisplay = `$${(line.amount / 100).toFixed(2)}`;
          const thresholdDisplay = `$${(threshold / 100).toFixed(2)}`;
          await engine.createNotification({
            ledgerId: ledgerId!,
            userId: apiKeyInfo.userId,
            type: "capitalisation_check",
            severity: "warning",
            title: "Large expense — should this be capitalised?",
            body: `${amountDisplay} posted to ${acctResult.value.name}. Amounts over ${thresholdDisplay} may need to be recorded as fixed assets. Use check_capitalisation to verify.`,
            data: { transactionId: tx.id, accountId: line.accountId, amount: line.amount, threshold },
            actionType: "navigate",
            actionData: { url: "/fixed-assets" },
          });
          break; // One notification per transaction
        }
      }
    }
  } catch { /* Capitalisation check is best-effort — never block transaction creation */ }

  // Add usage header
  const newCount = tierUsed + 1;
  c.header("X-Kounta-Usage", `${newCount}/${tierLimit ?? "unlimited"}`);

  return created(c, result.value);
});

/** GET /v1/ledgers/:ledgerId/transactions — List transactions (paginated) */
transactionRoutes.get("/", async (c) => {
  const engine = c.get("engine");
  const ledgerId = c.req.param("ledgerId");
  const cursor = c.req.query("cursor");
  const limit = parseBoundedInt(c.req.query("limit"), { min: 1, max: 200, defaultValue: 50 });

  const result = await engine.listTransactions(ledgerId!, { cursor, limit });
  if (!result.ok) {
    return errorResponse(c, result.error);
  }

  // Add usage header to list response (best-effort)
  try {
    const apiKeyInfo = c.get("apiKeyInfo");
    if (apiKeyInfo) {
      const tierCheck = await engine.checkLimit(apiKeyInfo.userId, ledgerId!, "transactions");
      c.header("X-Kounta-Usage", `${tierCheck.used}/${tierCheck.limit ?? "unlimited"}`);
    }
  } catch { /* ignore — tier check may not be available */ }

  return paginated(c, result.value.data, result.value.nextCursor);
});

/** GET /v1/ledgers/:ledgerId/transactions/:transactionId — Get a single transaction */
transactionRoutes.get("/:transactionId", async (c) => {
  const engine = c.get("engine");
  const transactionId = c.req.param("transactionId");

  const result = await engine.getTransaction(transactionId);
  if (!result.ok) {
    return errorResponse(c, result.error);
  }

  // Enforce that the transaction belongs to the scoped ledger
  const ledgerId = c.req.param("ledgerId");
  if (result.value.ledgerId !== ledgerId) {
    return c.json(
      {
        error: {
          code: "TRANSACTION_NOT_FOUND",
          message: "Transaction not found in this ledger",
          details: [
            {
              field: "transactionId",
              actual: transactionId,
              suggestion:
                "This transaction exists but belongs to a different ledger. Verify you are using the correct ledger ID in the URL.",
            },
          ],
          requestId: c.get("requestId"),
        },
      },
      404
    );
  }

  return success(c, result.value);
});

// Schema for reversal request body
const reverseTransactionBodySchema = z.object({
  reason: z.string().min(1).max(1000),
});

/** POST /v1/ledgers/:ledgerId/transactions/:transactionId/reverse — Reverse a transaction */
transactionRoutes.post("/:transactionId/reverse", async (c) => {
  const engine = c.get("engine");
  const transactionId = c.req.param("transactionId");
  const body = await validateBody(c, reverseTransactionBodySchema);
  if (body instanceof Response) return body;

  // Verify the transaction belongs to the scoped ledger
  const getResult = await engine.getTransaction(transactionId);
  if (!getResult.ok) {
    return errorResponse(c, getResult.error);
  }

  const ledgerId = c.req.param("ledgerId");
  if (getResult.value.ledgerId !== ledgerId) {
    return c.json(
      {
        error: {
          code: "TRANSACTION_NOT_FOUND",
          message: "Transaction not found in this ledger",
          details: [
            {
              field: "transactionId",
              actual: transactionId,
              suggestion:
                "This transaction exists but belongs to a different ledger. Verify you are using the correct ledger ID in the URL.",
            },
          ],
          requestId: c.get("requestId"),
        },
      },
      404
    );
  }

  const result = await engine.reverseTransaction(transactionId, body.reason);
  if (!result.ok) {
    return errorResponse(c, result.error);
  }

  return created(c, result.value);
});

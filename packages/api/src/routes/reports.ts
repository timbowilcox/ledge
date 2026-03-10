// ---------------------------------------------------------------------------
// Report routes — /v1/ledgers/:ledgerId/reports
// ---------------------------------------------------------------------------

import { Hono } from "hono";
import type { Env } from "../lib/context.js";
import { apiKeyAuth } from "../middleware/auth.js";
import { errorResponse, success } from "../lib/responses.js";

export const reportRoutes = new Hono<Env>();

// All report routes require API key auth
reportRoutes.use("/*", apiKeyAuth);

/** GET /v1/ledgers/:ledgerId/reports/income-statement?startDate=...&endDate=... */
reportRoutes.get("/income-statement", (c) => {
  const engine = c.get("engine");
  const ledgerId = c.req.param("ledgerId")!;
  const startDate = c.req.query("startDate");
  const endDate = c.req.query("endDate");

  if (!startDate || !endDate) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "startDate and endDate query parameters are required",
          details: [
            {
              field: "query",
              suggestion:
                "Add ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD query parameters. Example: ?startDate=2025-01-01&endDate=2025-12-31",
            },
          ],
          requestId: c.get("requestId"),
        },
      },
      400,
    );
  }

  const result = engine.generateIncomeStatement(ledgerId, startDate, endDate);
  if (!result.ok) {
    return errorResponse(c, result.error);
  }

  return success(c, result.value);
});

/** GET /v1/ledgers/:ledgerId/reports/balance-sheet?asOfDate=... */
reportRoutes.get("/balance-sheet", (c) => {
  const engine = c.get("engine");
  const ledgerId = c.req.param("ledgerId")!;
  const asOfDate = c.req.query("asOfDate");

  if (!asOfDate) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "asOfDate query parameter is required",
          details: [
            {
              field: "asOfDate",
              suggestion:
                "Add ?asOfDate=YYYY-MM-DD query parameter. Example: ?asOfDate=2025-12-31",
            },
          ],
          requestId: c.get("requestId"),
        },
      },
      400,
    );
  }

  const result = engine.generateBalanceSheet(ledgerId, asOfDate);
  if (!result.ok) {
    return errorResponse(c, result.error);
  }

  return success(c, result.value);
});

/** GET /v1/ledgers/:ledgerId/reports/cash-flow?startDate=...&endDate=... */
reportRoutes.get("/cash-flow", (c) => {
  const engine = c.get("engine");
  const ledgerId = c.req.param("ledgerId")!;
  const startDate = c.req.query("startDate");
  const endDate = c.req.query("endDate");

  if (!startDate || !endDate) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "startDate and endDate query parameters are required",
          details: [
            {
              field: "query",
              suggestion:
                "Add ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD query parameters. Example: ?startDate=2025-01-01&endDate=2025-12-31",
            },
          ],
          requestId: c.get("requestId"),
        },
      },
      400,
    );
  }

  const result = engine.generateCashFlow(ledgerId, startDate, endDate);
  if (!result.ok) {
    return errorResponse(c, result.error);
  }

  return success(c, result.value);
});

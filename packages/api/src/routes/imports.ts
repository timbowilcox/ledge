// ---------------------------------------------------------------------------
// Import routes — /v1/ledgers/:ledgerId/imports and /v1/imports/:batchId
// ---------------------------------------------------------------------------

import { Hono } from "hono";
import type { Env } from "../lib/context.js";
import { apiKeyAuth } from "../middleware/auth.js";
import { errorResponse, created, success, paginated } from "../lib/responses.js";

// ---------------------------------------------------------------------------
// Ledger-scoped routes: /v1/ledgers/:ledgerId/imports
// ---------------------------------------------------------------------------

export const importRoutes = new Hono<Env>();

importRoutes.use("/*", apiKeyAuth);

/** POST /v1/ledgers/:ledgerId/imports — Create a new import batch */
importRoutes.post("/", async (c) => {
  const engine = c.get("engine");
  const ledgerId = c.req.param("ledgerId");
  const body = await c.req.json();

  const result = await engine.createImport({
    ledgerId: ledgerId!,
    fileContent: body.fileContent,
    fileType: body.fileType,
    filename: body.filename,
  });

  if (!result.ok) {
    return errorResponse(c, result.error);
  }

  return created(c, result.value);
});

/** GET /v1/ledgers/:ledgerId/imports — List import batches (paginated) */
importRoutes.get("/", async (c) => {
  const engine = c.get("engine");
  const ledgerId = c.req.param("ledgerId");
  const cursor = c.req.query("cursor");
  const limitStr = c.req.query("limit");
  const limit = limitStr ? parseInt(limitStr, 10) : undefined;

  const result = await engine.listImportBatches(ledgerId!, { cursor, limit });
  if (!result.ok) {
    return errorResponse(c, result.error);
  }

  return paginated(c, result.value.data, result.value.nextCursor);
});

// ---------------------------------------------------------------------------
// Batch-scoped routes: /v1/imports/:batchId
// ---------------------------------------------------------------------------

export const importBatchRoutes = new Hono<Env>();

importBatchRoutes.use("/*", apiKeyAuth);

/** GET /v1/imports/:batchId — Get import batch detail */
importBatchRoutes.get("/", async (c) => {
  const engine = c.get("engine");
  const batchId = c.req.param("batchId");

  const result = await engine.getImportBatch(batchId!);
  if (!result.ok) {
    return errorResponse(c, result.error);
  }

  return success(c, result.value);
});

/** POST /v1/imports/:batchId/confirm — Confirm/reject/override matches */
importBatchRoutes.post("/confirm", async (c) => {
  const engine = c.get("engine");
  const batchId = c.req.param("batchId");
  const body = await c.req.json();

  const result = await engine.confirmMatches({
    batchId: batchId!,
    actions: body.actions,
  });

  if (!result.ok) {
    return errorResponse(c, result.error);
  }

  return success(c, result.value);
});

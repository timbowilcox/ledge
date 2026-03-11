// ---------------------------------------------------------------------------
// Audit log routes — /v1/ledgers/:ledgerId/audit
// ---------------------------------------------------------------------------

import { Hono } from "hono";
import type { Env } from "../lib/context.js";
import { apiKeyAuth } from "../middleware/auth.js";
import { errorResponse, paginated } from "../lib/responses.js";

export const auditRoutes = new Hono<Env>();

// All audit routes require API key auth
auditRoutes.use("/*", apiKeyAuth);

/** GET /v1/ledgers/:ledgerId/audit — List audit entries (paginated) */
auditRoutes.get("/", async (c) => {
  const engine = c.get("engine");
  const ledgerId = c.req.param("ledgerId");
  const cursor = c.req.query("cursor");
  const limitStr = c.req.query("limit");
  const limit = limitStr ? parseInt(limitStr, 10) : undefined;

  const result = await engine.listAuditEntries(ledgerId!, { cursor, limit });
  if (!result.ok) {
    return errorResponse(c, result.error);
  }

  return paginated(c, result.value.data, result.value.nextCursor);
});

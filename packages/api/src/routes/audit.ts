// ---------------------------------------------------------------------------
// Audit log routes — /v1/ledgers/:ledgerId/audit
// ---------------------------------------------------------------------------

import { Hono } from "hono";
import type { Env } from "../lib/context.js";
import { apiKeyAuth } from "../middleware/auth.js";
import { errorResponse, paginated } from "../lib/responses.js";
import { parseBoundedInt } from "../lib/validate.js";

export const auditRoutes = new Hono<Env>();

// All audit routes require API key auth
auditRoutes.use("/*", apiKeyAuth);

/** GET /v1/ledgers/:ledgerId/audit — List audit entries (paginated) */
auditRoutes.get("/", async (c) => {
  const engine = c.get("engine");
  const ledgerId = c.req.param("ledgerId");
  const cursor = c.req.query("cursor");
  const limit = parseBoundedInt(c.req.query("limit"), { min: 1, max: 200, defaultValue: 50 });

  const result = await engine.listAuditEntries(ledgerId!, { cursor, limit });
  if (!result.ok) {
    return errorResponse(c, result.error);
  }

  return paginated(c, result.value.data, result.value.nextCursor);
});

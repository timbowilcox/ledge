// ---------------------------------------------------------------------------
// API key management routes — /v1/api-keys
// ---------------------------------------------------------------------------

import { Hono } from "hono";
import type { Env } from "../lib/context.js";
import { adminAuth } from "../middleware/auth.js";
import { errorResponse, created, success } from "../lib/responses.js";

export const apiKeyRoutes = new Hono<Env>();

// All API key management routes require admin auth
apiKeyRoutes.use("/*", adminAuth);

/** POST /v1/api-keys — Create a new API key */
apiKeyRoutes.post("/", async (c) => {
  const engine = c.get("engine");
  const body = await c.req.json();

  if (!body.userId || !body.ledgerId || !body.name) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "userId, ledgerId, and name are required",
          details: [
            {
              field: "body",
              suggestion:
                'Provide { "userId": "<user-uuid>", "ledgerId": "<ledger-uuid>", "name": "<key-name>" } in the request body.',
            },
          ],
          requestId: c.get("requestId"),
        },
      },
      400
    );
  }

  const result = engine.createApiKey({
    userId: body.userId,
    ledgerId: body.ledgerId,
    name: body.name,
  });

  if (!result.ok) {
    return errorResponse(c, result.error);
  }

  // Return the raw key — it is only shown once
  return created(c, {
    ...result.value.apiKey,
    rawKey: result.value.rawKey,
  });
});

/** GET /v1/api-keys?ledgerId=xxx — List API keys for a ledger */
apiKeyRoutes.get("/", async (c) => {
  const engine = c.get("engine");
  const ledgerId = c.req.query("ledgerId");

  if (!ledgerId) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "ledgerId query parameter is required",
          details: [
            {
              field: "ledgerId",
              suggestion:
                "Add ?ledgerId=<uuid> query parameter to filter API keys by ledger.",
            },
          ],
          requestId: c.get("requestId"),
        },
      },
      400
    );
  }

  const result = engine.listApiKeys(ledgerId);
  if (!result.ok) {
    return errorResponse(c, result.error);
  }

  // Never expose keyHash in list responses
  const sanitized = result.value.map(({ keyHash: _, ...rest }) => rest);
  return success(c, sanitized);
});

/** DELETE /v1/api-keys/:keyId — Revoke an API key */
apiKeyRoutes.delete("/:keyId", async (c) => {
  const engine = c.get("engine");
  const keyId = c.req.param("keyId");

  const result = engine.revokeApiKey(keyId);
  if (!result.ok) {
    return errorResponse(c, result.error);
  }

  const { keyHash: _, ...sanitized } = result.value;
  return success(c, sanitized);
});

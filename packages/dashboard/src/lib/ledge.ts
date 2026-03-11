// ---------------------------------------------------------------------------
// Shared Ledge SDK client — server-side only.
//
// Two modes:
//   getLedgeClient() / getLedgeId() — env-based singleton for admin tasks
//   getSessionClient() — per-request client using session API key
// ---------------------------------------------------------------------------

import { Ledge } from "@ledge/sdk";
import { auth } from "./auth";

function getEnvOrThrow(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error("Missing required environment variable: " + name);
  return value;
}

let _client: Ledge | null = null;

/** Singleton SDK client (env-based). Used for admin tasks like listing templates. */
export function getLedgeClient(): Ledge {
  if (!_client) {
    _client = new Ledge({
      baseUrl: getEnvOrThrow("LEDGE_API_URL"),
      apiKey: process.env.LEDGE_API_KEY ?? "unused",
      adminSecret: process.env.LEDGE_ADMIN_SECRET ?? undefined,
    });
  }
  return _client;
}

/** The ledger ID from env (legacy fallback). */
export function getLedgerId(): string {
  return getEnvOrThrow("LEDGE_LEDGER_ID");
}

/**
 * Per-request SDK client using the session's API key.
 * Creates a new Ledge instance for each request so each user
 * gets their own scoped client.
 */
export async function getSessionClient(): Promise<{ client: Ledge; ledgerId: string }> {
  const session = await auth();
  if (!session?.apiKey || !session.ledgerId) {
    throw new Error("No authenticated session - sign in required");
  }

  const client = new Ledge({
    baseUrl: getEnvOrThrow("LEDGE_API_URL"),
    apiKey: session.apiKey,
    adminSecret: process.env.LEDGE_ADMIN_SECRET ?? undefined,
  });

  return { client, ledgerId: session.ledgerId };
}

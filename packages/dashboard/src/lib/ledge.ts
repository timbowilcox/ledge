// ---------------------------------------------------------------------------
// Shared Ledge SDK client — server-side only.
//
// Reads configuration from environment variables:
//   LEDGE_API_URL      — Base URL of the Ledge API
//   LEDGE_API_KEY      — API key (scoped to a ledger)
//   LEDGE_ADMIN_SECRET — Admin secret for privileged operations
//   LEDGE_LEDGER_ID    — Default ledger ID for dashboard queries
// ---------------------------------------------------------------------------

import { Ledge } from "@ledge/sdk";

function getEnvOrThrow(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error("Missing required environment variable: " + name);
  return value;
}

let _client: Ledge | null = null;

/** Singleton SDK client. Created lazily on first access. */
export function getLedgeClient(): Ledge {
  if (!_client) {
    _client = new Ledge({
      baseUrl: getEnvOrThrow("LEDGE_API_URL"),
      apiKey: getEnvOrThrow("LEDGE_API_KEY"),
      adminSecret: process.env["LEDGE_ADMIN_SECRET"] ?? undefined,
    });
  }
  return _client;
}

/** The ledger ID used by the dashboard. */
export function getLedgerId(): string {
  return getEnvOrThrow("LEDGE_LEDGER_ID");
}

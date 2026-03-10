import { Ledge } from "@ledge/sdk";

const apiKey = process.env.LEDGE_API_KEY ?? "";
const adminSecret = process.env.LEDGE_ADMIN_SECRET ?? "";
const baseUrl = process.env.LEDGE_BASE_URL ?? "http://localhost:3001";

export const ledge = new Ledge({
  apiKey,
  adminSecret,
  baseUrl,
});

export const LEDGER_ID = process.env.LEDGE_LEDGER_ID ?? "";

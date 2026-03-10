import { Ledge } from "@ledge/sdk";

export const ledge = new Ledge({
  baseUrl: process.env.LEDGE_BASE_URL ?? "http://localhost:3100",
  apiKey: process.env.LEDGE_API_KEY ?? "",
});

export const ledgerId = process.env.LEDGE_LEDGER_ID ?? "";

"use server";

// ---------------------------------------------------------------------------
// Server actions for dashboard data fetching and mutations.
// These run on the server and are called from client components.
// ---------------------------------------------------------------------------

import { getLedgeClient, getLedgerId } from "./ledge";
import type {
  TransactionWithLines,
  AccountWithBalance,
  StatementResponse,
  PaginatedResult,
} from "@ledge/sdk";
import type { ApiKeySafe, ApiKeyWithRaw } from "@ledge/sdk";

// --- Transactions (paginated) -----------------------------------------------

export async function fetchTransactions(
  cursor?: string,
  limit = 50,
): Promise<PaginatedResult<TransactionWithLines>> {
  const client = getLedgeClient();
  const ledgerId = getLedgerId();
  return client.transactions.list(ledgerId, { cursor, limit });
}

// --- Accounts ---------------------------------------------------------------

export async function fetchAccounts(): Promise<AccountWithBalance[]> {
  const client = getLedgeClient();
  const ledgerId = getLedgerId();
  return client.accounts.list(ledgerId);
}

// --- Statements -------------------------------------------------------------

export async function fetchIncomeStatement(
  startDate: string,
  endDate: string,
): Promise<StatementResponse> {
  const client = getLedgeClient();
  const ledgerId = getLedgerId();
  return client.reports.incomeStatement(ledgerId, startDate, endDate);
}

export async function fetchBalanceSheet(
  asOfDate: string,
): Promise<StatementResponse> {
  const client = getLedgeClient();
  const ledgerId = getLedgerId();
  return client.reports.balanceSheet(ledgerId, asOfDate);
}

export async function fetchCashFlow(
  startDate: string,
  endDate: string,
): Promise<StatementResponse> {
  const client = getLedgeClient();
  const ledgerId = getLedgerId();
  return client.reports.cashFlow(ledgerId, startDate, endDate);
}

// --- API Keys (admin) -------------------------------------------------------

export async function fetchApiKeys(): Promise<ApiKeySafe[]> {
  const client = getLedgeClient();
  const ledgerId = getLedgerId();
  return client.apiKeys.list(ledgerId);
}

export async function createApiKey(name: string): Promise<ApiKeyWithRaw> {
  const client = getLedgeClient();
  const ledgerId = getLedgerId();
  // Use a system user ID for dashboard-created keys
  return client.apiKeys.create({
    userId: "00000000-0000-0000-0000-000000000001",
    ledgerId,
    name,
  });
}

export async function revokeApiKey(keyId: string): Promise<ApiKeySafe> {
  const client = getLedgeClient();
  return client.apiKeys.revoke(keyId);
}

"use server";

// ---------------------------------------------------------------------------
// Server actions for dashboard data fetching and mutations.
// These run on the server and are called from client components.
// ---------------------------------------------------------------------------

import { getSessionClient } from "./ledge";
import { getLedgeClient } from "./ledge";
import { auth } from "./auth";
import type {
  TransactionWithLines,
  AccountWithBalance,
  StatementResponse,
  PaginatedResult,
} from "@ledge/sdk";
import type { ApiKeySafe, ApiKeyWithRaw } from "@ledge/sdk";

// --- Transactions (paginated) ----------------------------------------------

export async function fetchTransactions(
  cursor?: string,
  limit = 50,
): Promise<PaginatedResult<TransactionWithLines>> {
  const { client, ledgerId } = await getSessionClient();
  return client.transactions.list(ledgerId, { cursor, limit });
}

// --- Accounts --------------------------------------------------------------

export async function fetchAccounts(): Promise<AccountWithBalance[]> {
  const { client, ledgerId } = await getSessionClient();
  return client.accounts.list(ledgerId);
}

// --- Statements ------------------------------------------------------------

export async function fetchIncomeStatement(
  startDate: string,
  endDate: string,
): Promise<StatementResponse> {
  const { client, ledgerId } = await getSessionClient();
  return client.reports.incomeStatement(ledgerId, startDate, endDate);
}

export async function fetchBalanceSheet(
  asOfDate: string,
): Promise<StatementResponse> {
  const { client, ledgerId } = await getSessionClient();
  return client.reports.balanceSheet(ledgerId, asOfDate);
}

export async function fetchCashFlow(
  startDate: string,
  endDate: string,
): Promise<StatementResponse> {
  const { client, ledgerId } = await getSessionClient();
  return client.reports.cashFlow(ledgerId, startDate, endDate);
}

// --- API Keys (admin) ------------------------------------------------------

export async function fetchApiKeys(): Promise<ApiKeySafe[]> {
  const { client, ledgerId } = await getSessionClient();
  return client.apiKeys.list(ledgerId);
}

export async function createApiKey(name: string): Promise<ApiKeyWithRaw> {
  const session = await auth();
  const { client, ledgerId } = await getSessionClient();
  return client.apiKeys.create({
    userId: session?.userId ?? "unknown",
    ledgerId,
    name,
  });
}

export async function revokeApiKey(keyId: string): Promise<ApiKeySafe> {
  const { client } = await getSessionClient();
  return client.apiKeys.revoke(keyId);
}

// --- Template application -------------------------------------------------

export async function applyTemplateAction(templateSlug: string): Promise<void> {
  const { ledgerId } = await getSessionClient();
  const adminClient = getLedgeClient();
  await adminClient.templates.apply(ledgerId, templateSlug);
}

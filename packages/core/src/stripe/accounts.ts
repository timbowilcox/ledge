// ---------------------------------------------------------------------------
// Stripe account auto-creation — ensure required accounts exist in ledger.
// ---------------------------------------------------------------------------

import type { Database } from "../db/database.js";
import type { LedgerEngine } from "../engine/index.js";

/** Account definitions for Stripe integration. */
const STRIPE_ACCOUNTS = [
  { code: "1050", name: "Stripe Balance", type: "asset" as const, normalBalance: "debit" as const },
  { code: "4100", name: "Refunds", type: "revenue" as const, normalBalance: "credit" as const },
  { code: "5200", name: "Payment Processing Fees", type: "expense" as const, normalBalance: "debit" as const },
] as const;

/**
 * Ensure required Stripe accounts exist in the ledger.
 * Creates any that are missing. Skips 4000 Revenue if any revenue account exists.
 */
export const ensureStripeAccounts = async (
  db: Database,
  engine: LedgerEngine,
  ledgerId: string,
): Promise<void> => {
  // Get existing accounts for this ledger
  const existingAccounts = await db.all<{ code: string; type: string }>(
    `SELECT code, type FROM accounts WHERE ledger_id = ? AND status = 'active'`,
    [ledgerId],
  );

  const existingCodes = new Set(existingAccounts.map((a) => a.code));

  for (const acct of STRIPE_ACCOUNTS) {
    // Skip creating 4100 Refunds if a revenue account already exists?
    // No — we always create 4100 Refunds (it's a contra-revenue account).
    // The spec says: "Don't create 4000 Revenue if any revenue account exists"
    // 4100 Refunds is separate and always needed.

    if (existingCodes.has(acct.code)) continue;

    const result = await engine.createAccount({
      ledgerId,
      code: acct.code,
      name: acct.name,
      type: acct.type,
      normalBalance: acct.normalBalance,
    });

    if (!result.ok) {
      // Duplicate code is fine (race condition), other errors are logged
      if (result.error.code !== "DUPLICATE_ACCOUNT_CODE") {
        console.error(`Failed to create Stripe account ${acct.code}:`, result.error);
      }
    }
  }
};

/**
 * Find an account by its code in a ledger.
 * Returns the account ID if found, null otherwise.
 */
export const findAccountByCode = async (
  db: Database,
  ledgerId: string,
  code: string,
): Promise<string | null> => {
  const row = await db.get<{ id: string }>(
    `SELECT id FROM accounts WHERE ledger_id = ? AND code = ? AND status = 'active'`,
    [ledgerId, code],
  );
  return row?.id ?? null;
};

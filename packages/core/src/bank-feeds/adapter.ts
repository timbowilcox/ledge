// ---------------------------------------------------------------------------
// Bank transaction → ParsedRow adapter.
// Maps bank feed transactions to the ParsedRow format used by the existing
// reconciliation matcher, so we reuse the proven scoring algorithm.
// ---------------------------------------------------------------------------

import type { ParsedRow } from "../import/types.js";
import type { BankTransaction, ProviderBankTransaction } from "./types.js";

/**
 * Adapt a stored BankTransaction to a ParsedRow for reconciliation matching.
 * Amount sign convention: negative = outflow (debit from bank perspective),
 * positive = inflow (credit from bank perspective).
 */
export function bankTransactionToParseRow(txn: BankTransaction): ParsedRow {
  return {
    date: txn.date,
    amount: txn.type === "debit" ? -txn.amount : txn.amount,
    payee: txn.description,
    memo: txn.reference,
    rawData: txn.rawData,
  };
}

/**
 * Adapt a provider transaction (not yet stored) to a ParsedRow.
 */
export function providerTransactionToParseRow(txn: ProviderBankTransaction): ParsedRow {
  return {
    date: txn.date,
    amount: txn.type === "debit" ? -txn.amount : txn.amount,
    payee: txn.description,
    memo: txn.reference,
    rawData: txn.rawData,
  };
}

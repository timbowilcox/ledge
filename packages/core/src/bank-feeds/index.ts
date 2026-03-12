// ---------------------------------------------------------------------------
// Bank feeds module — export barrel
// ---------------------------------------------------------------------------

export * from "./types.js";
export { BasiqProvider } from "./basiq.js";
export { PlaidProvider } from "./plaid.js";
export { createBankFeedProvider } from "./factory.js";
export { bankTransactionToParseRow, providerTransactionToParseRow } from "./adapter.js";

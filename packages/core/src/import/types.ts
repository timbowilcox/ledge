// ---------------------------------------------------------------------------
// Import module types — parsed rows, match results, and confirmation actions.
// ---------------------------------------------------------------------------

export interface ParsedRow {
  readonly date: string;                          // Normalized ISO YYYY-MM-DD
  readonly amount: number;                        // Integer cents (negative = outflow)
  readonly payee: string;
  readonly memo: string | null;
  readonly rawData: Record<string, unknown>;
}

export interface MatchResult {
  readonly rowIndex: number;
  readonly transactionId: string | null;          // null if unmatched
  readonly confidence: number;                     // 0.0 – 1.0
  readonly matchStatus: "matched" | "suggested" | "unmatched";
  readonly breakdown: {
    readonly dateScore: number;                    // 0–40
    readonly amountScore: number;                  // 0–40
    readonly textScore: number;                    // 0–20
  };
}

export interface MatchConfig {
  readonly autoMatchThreshold: number;             // Default 0.95 (95%)
  readonly suggestThreshold: number;               // Default 0.60 (60%)
}

export const DEFAULT_MATCH_CONFIG: MatchConfig = {
  autoMatchThreshold: 0.95,
  suggestThreshold: 0.60,
};

export interface ConfirmAction {
  readonly rowId: string;
  readonly action: "confirm" | "reject" | "override";
  readonly overrideTransactionId?: string;         // Required when action = "override"
}

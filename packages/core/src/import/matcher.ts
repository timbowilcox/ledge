// ---------------------------------------------------------------------------
// Matching engine — scores import rows against existing transactions.
//
// Scoring algorithm (0–100, normalized to 0.0–1.0):
//   Date:   0–40 pts (exact=40, ±1d=30, ±3d=15, ±7d=5, >7d=0)
//   Amount: 0–40 pts (exact=40, ±1%=25, ±5%=10, >5%=0)
//   Text:   0–20 pts (Jaccard similarity of tokenized payee+memo vs txn memo)
//
// Greedy assignment: highest-scoring matches first, each transaction matched
// at most once to prevent duplicate assignments.
// ---------------------------------------------------------------------------

import type { TransactionWithLines } from "../types/index.js";
import type { ParsedRow, MatchResult, MatchConfig } from "./types.js";
import { DEFAULT_MATCH_CONFIG } from "./types.js";

// ---------------------------------------------------------------------------
// Scoring helpers
// ---------------------------------------------------------------------------

/** Absolute difference in days between two ISO date strings. */
function dayDiff(a: string, b: string): number {
  const msPerDay = 86_400_000;
  const da = new Date(a + "T00:00:00Z").getTime();
  const db = new Date(b + "T00:00:00Z").getTime();
  return Math.abs(da - db) / msPerDay;
}

function scoreDate(importDate: string, txnDate: string): number {
  const diff = dayDiff(importDate, txnDate);
  if (diff === 0) return 40;
  if (diff <= 1) return 30;
  if (diff <= 3) return 15;
  if (diff <= 7) return 5;
  return 0;
}

function scoreAmount(importAmount: number, txnAmount: number): number {
  // Compare absolute values — import amounts may be signed differently
  const a = Math.abs(importAmount);
  const b = Math.abs(txnAmount);

  if (a === b) return 40;
  if (a === 0 && b === 0) return 40;
  if (a === 0 || b === 0) return 0;

  const pctDiff = Math.abs(a - b) / Math.max(a, b);
  if (pctDiff <= 0.01) return 25;
  if (pctDiff <= 0.05) return 10;
  return 0;
}

/**
 * Tokenize a string for Jaccard similarity: lowercase, split on
 * non-alphanumeric, filter tokens shorter than 2 chars.
 */
function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 2),
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;

  let intersectionSize = 0;
  for (const token of a) {
    if (b.has(token)) intersectionSize++;
  }

  const unionSize = a.size + b.size - intersectionSize;
  if (unionSize === 0) return 0;

  return intersectionSize / unionSize;
}

function scoreText(importPayee: string, importMemo: string | null, txnMemo: string, sourceRef?: string | null): number {
  const importText = [importPayee, importMemo ?? ""].join(" ");
  const importTokens = tokenize(importText);
  const txnTokens = tokenize(txnMemo);

  let base = Math.round(jaccardSimilarity(importTokens, txnTokens) * 20);

  // Stripe payout boost: when a bank feed row mentioning "stripe" matches
  // a ledger transaction sourced from a Stripe payout, give full text score.
  // This prevents double-counting when both Stripe Connect and bank feeds
  // import the same payout.
  if (
    sourceRef?.startsWith("stripe:payout:") &&
    importText.toLowerCase().includes("stripe")
  ) {
    base = 20;
  }

  return base;
}

// ---------------------------------------------------------------------------
// Transaction amount calculation
// ---------------------------------------------------------------------------

/**
 * Compute the net amount of a transaction in cents.
 * Uses the total debit amount (which equals total credit for balanced txns).
 */
function transactionAmount(txn: TransactionWithLines): number {
  return txn.lines
    .filter((l) => l.direction === "debit")
    .reduce((sum, l) => sum + l.amount, 0);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

interface ScoredCandidate {
  rowIndex: number;
  transactionId: string;
  totalScore: number;
  dateScore: number;
  amountScore: number;
  textScore: number;
}

/**
 * Match parsed import rows against existing transactions.
 * Returns one MatchResult per import row.
 */
export function matchRows(
  parsedRows: ParsedRow[],
  existingTransactions: TransactionWithLines[],
  config: MatchConfig = DEFAULT_MATCH_CONFIG,
): MatchResult[] {
  // Build all candidates: score every (row, txn) pair
  const candidates: ScoredCandidate[] = [];

  for (let rowIdx = 0; rowIdx < parsedRows.length; rowIdx++) {
    const row = parsedRows[rowIdx]!;

    for (const txn of existingTransactions) {
      const dateScore = scoreDate(row.date, txn.date);
      const amountScore = scoreAmount(row.amount, transactionAmount(txn));
      const textScore = scoreText(row.payee, row.memo, txn.memo, txn.sourceRef);
      const totalScore = dateScore + amountScore + textScore;

      if (totalScore > 0) {
        candidates.push({
          rowIndex: rowIdx,
          transactionId: txn.id,
          totalScore,
          dateScore,
          amountScore,
          textScore,
        });
      }
    }
  }

  // Sort by score descending for greedy assignment
  candidates.sort((a, b) => b.totalScore - a.totalScore);

  // Greedy assignment: each row and each transaction matched at most once
  const assignedRows = new Set<number>();
  const assignedTxns = new Set<string>();
  const rowMatches = new Map<number, ScoredCandidate>();

  for (const candidate of candidates) {
    if (assignedRows.has(candidate.rowIndex)) continue;
    if (assignedTxns.has(candidate.transactionId)) continue;

    rowMatches.set(candidate.rowIndex, candidate);
    assignedRows.add(candidate.rowIndex);
    assignedTxns.add(candidate.transactionId);
  }

  // Build results
  const results: MatchResult[] = [];

  for (let i = 0; i < parsedRows.length; i++) {
    const match = rowMatches.get(i);

    if (match) {
      const confidence = match.totalScore / 100;
      let matchStatus: "matched" | "suggested" | "unmatched";

      if (confidence >= config.autoMatchThreshold) {
        matchStatus = "matched";
      } else if (confidence >= config.suggestThreshold) {
        matchStatus = "suggested";
      } else {
        matchStatus = "unmatched";
      }

      results.push({
        rowIndex: i,
        transactionId: matchStatus === "unmatched" ? null : match.transactionId,
        confidence,
        matchStatus,
        breakdown: {
          dateScore: match.dateScore,
          amountScore: match.amountScore,
          textScore: match.textScore,
        },
      });
    } else {
      results.push({
        rowIndex: i,
        transactionId: null,
        confidence: 0,
        matchStatus: "unmatched",
        breakdown: { dateScore: 0, amountScore: 0, textScore: 0 },
      });
    }
  }

  return results;
}

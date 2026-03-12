// ---------------------------------------------------------------------------
// OFX Parser — regex-based SGML extraction for OFX 1.x bank statements.
//
// OFX 1.x is SGML (not XML), so tags may not be properly closed.
// We extract <STMTTRN> blocks and read DTPOSTED, TRNAMT, NAME, MEMO, FITID.
// ---------------------------------------------------------------------------

import type { ParsedRow } from "./types.js";
import { toSmallestUnit } from "../currency-utils.js";

// ---------------------------------------------------------------------------
// Tag extraction
// ---------------------------------------------------------------------------

/**
 * Extract the value of a simple OFX tag from a block of text.
 * OFX 1.x uses `<TAG>value` without closing tags for simple values.
 */
function extractTag(block: string, tagName: string): string | null {
  // Match <TAG>value (up to next < or end of string/line)
  const regex = new RegExp(`<${tagName}>([^<\\r\\n]+)`, "i");
  const match = block.match(regex);
  return match ? match[1]!.trim() : null;
}

// ---------------------------------------------------------------------------
// Date normalization
// ---------------------------------------------------------------------------

/**
 * OFX dates: YYYYMMDD or YYYYMMDDHHMMSS[.XXX[:tz]]
 * Normalize to ISO YYYY-MM-DD.
 */
function normalizeOFXDate(raw: string): string {
  // Strip time portion and timezone
  const dateOnly = raw.replace(/[[\]]/g, "").slice(0, 8);

  if (dateOnly.length !== 8 || !/^\d{8}$/.test(dateOnly)) {
    throw new Error(`Invalid OFX date: "${raw}"`);
  }

  const year = dateOnly.slice(0, 4);
  const month = dateOnly.slice(4, 6);
  const day = dateOnly.slice(6, 8);

  return `${year}-${month}-${day}`;
}

// ---------------------------------------------------------------------------
// Amount normalization
// ---------------------------------------------------------------------------

/**
 * OFX amounts are signed decimal strings (e.g., "-50.00", "1234.56").
 * Convert to integer cents.
 */
function normalizeOFXAmount(raw: string, currencyCode = "USD"): number {
  const cleaned = raw.trim().replace(/,/g, "");
  const value = parseFloat(cleaned);
  if (isNaN(value)) {
    throw new Error(`Cannot parse OFX amount: "${raw}"`);
  }
  return toSmallestUnit(value, currencyCode);
}

// ---------------------------------------------------------------------------
// Transaction block extraction
// ---------------------------------------------------------------------------

/**
 * Extract all STMTTRN blocks from OFX content.
 * Handles both closed tags (`</STMTTRN>`) and unclosed (up to next `<STMTTRN>` or `</BANKTRANLIST>`).
 */
function extractTransactionBlocks(content: string): string[] {
  const blocks: string[] = [];

  // Try closed tags first
  const closedRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let match: RegExpExecArray | null;

  match = closedRegex.exec(content);
  while (match !== null) {
    blocks.push(match[1]!);
    match = closedRegex.exec(content);
  }

  // If we found closed blocks, return them
  if (blocks.length > 0) return blocks;

  // Fall back to unclosed tag extraction
  const openRegex = /<STMTTRN>/gi;
  const indices: number[] = [];
  let openMatch = openRegex.exec(content);
  while (openMatch !== null) {
    indices.push(openMatch.index + openMatch[0].length);
    openMatch = openRegex.exec(content);
  }

  for (let i = 0; i < indices.length; i++) {
    const start = indices[i]!;
    const end = i + 1 < indices.length ? indices[i + 1]! - "<STMTTRN>".length : content.length;
    blocks.push(content.slice(start, end));
  }

  return blocks;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse an OFX file string into normalized rows.
 * Throws if no STMTTRN blocks are found or parsing fails.
 */
export function parseOFX(content: string): ParsedRow[] {
  const blocks = extractTransactionBlocks(content);

  if (blocks.length === 0) {
    throw new Error("OFX file contains no transaction blocks (STMTTRN)");
  }

  const results: ParsedRow[] = [];

  for (const block of blocks) {
    const dtPosted = extractTag(block, "DTPOSTED");
    const trnAmt = extractTag(block, "TRNAMT");
    const name = extractTag(block, "NAME");
    const memo = extractTag(block, "MEMO");
    const fitId = extractTag(block, "FITID");
    const trnType = extractTag(block, "TRNTYPE");

    if (!dtPosted || !trnAmt) {
      // Skip blocks missing required fields
      continue;
    }

    const date = normalizeOFXDate(dtPosted);
    const amount = normalizeOFXAmount(trnAmt);
    const payee = name ?? "Unknown";

    const rawData: Record<string, unknown> = {
      DTPOSTED: dtPosted,
      TRNAMT: trnAmt,
    };
    if (name) rawData["NAME"] = name;
    if (memo) rawData["MEMO"] = memo;
    if (fitId) rawData["FITID"] = fitId;
    if (trnType) rawData["TRNTYPE"] = trnType;

    results.push({
      date,
      amount,
      payee,
      memo: memo ?? null,
      rawData,
    });
  }

  if (results.length === 0) {
    throw new Error("OFX file contained no parseable transactions");
  }

  return results;
}

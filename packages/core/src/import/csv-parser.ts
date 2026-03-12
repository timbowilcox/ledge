// ---------------------------------------------------------------------------
// CSV Parser — hand-rolled, no external dependencies.
//
// Handles: quoted fields, escaped quotes, CRLF/LF, auto-detected headers,
// date normalization (ISO, US, EU, DD-Mon-YYYY), amount normalization
// (currency symbols, parenthesized negatives, conversion to integer cents).
// ---------------------------------------------------------------------------

import type { ParsedRow } from "./types.js";
import { toSmallestUnit } from "../currency-utils.js";

// ---------------------------------------------------------------------------
// Low-level CSV tokenizer
// ---------------------------------------------------------------------------

function splitCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const ch = line[i]!;

    if (inQuotes) {
      if (ch === '"') {
        // Escaped quote ""
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        current += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === ",") {
        fields.push(current.trim());
        current = "";
        i++;
      } else {
        current += ch;
        i++;
      }
    }
  }

  fields.push(current.trim());
  return fields;
}

function parseCSVLines(content: string): string[][] {
  // Normalize line endings
  const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n").filter((l) => l.trim().length > 0);
  return lines.map(splitCSVLine);
}

// ---------------------------------------------------------------------------
// Header detection
// ---------------------------------------------------------------------------

interface ColumnMap {
  date: number;
  amount: number;
  payee: number;
  memo: number | null;
}

const DATE_HEADERS = ["date", "transaction date", "trans date", "posted date", "posting date"];
const AMOUNT_HEADERS = ["amount", "debit", "credit", "transaction amount", "sum"];
const PAYEE_HEADERS = ["payee", "description", "name", "merchant", "vendor", "transaction description"];
const MEMO_HEADERS = ["memo", "reference", "note", "notes", "check number", "ref"];

function detectColumns(headerRow: string[]): ColumnMap | null {
  const lower = headerRow.map((h) => h.toLowerCase().trim());

  const dateIdx = lower.findIndex((h) => DATE_HEADERS.includes(h));
  const amountIdx = lower.findIndex((h) => AMOUNT_HEADERS.includes(h));
  const payeeIdx = lower.findIndex((h) => PAYEE_HEADERS.includes(h));
  const memoIdx = lower.findIndex((h) => MEMO_HEADERS.includes(h));

  if (dateIdx === -1 || amountIdx === -1 || payeeIdx === -1) {
    return null;
  }

  return {
    date: dateIdx,
    amount: amountIdx,
    payee: payeeIdx,
    memo: memoIdx === -1 ? null : memoIdx,
  };
}

// ---------------------------------------------------------------------------
// Date normalization
// ---------------------------------------------------------------------------

const MONTH_NAMES: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

/**
 * Normalize a date string to ISO YYYY-MM-DD.
 * Supported formats:
 *   - YYYY-MM-DD (ISO)
 *   - MM/DD/YYYY or MM-DD-YYYY (US)
 *   - DD/MM/YYYY or DD-MM-YYYY (EU — used when day > 12)
 *   - DD-Mon-YYYY or DD Mon YYYY (e.g. 15-Jan-2025)
 */
export function normalizeDate(raw: string): string {
  const trimmed = raw.trim();

  // ISO: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // DD-Mon-YYYY or DD Mon YYYY
  const monMatch = trimmed.match(/^(\d{1,2})[\s-]([A-Za-z]{3})[\s-](\d{4})$/);
  if (monMatch) {
    const day = monMatch[1]!.padStart(2, "0");
    const monthStr = monMatch[2]!.toLowerCase();
    const year = monMatch[3]!;
    const month = MONTH_NAMES[monthStr];
    if (month) {
      return `${year}-${month}-${day}`;
    }
  }

  // Slash or dash separated: could be US (MM/DD/YYYY) or EU (DD/MM/YYYY)
  const slashMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (slashMatch) {
    const a = parseInt(slashMatch[1]!, 10);
    const b = parseInt(slashMatch[2]!, 10);
    const year = slashMatch[3]!;

    // If first number > 12, it must be a day (EU format)
    if (a > 12) {
      return `${year}-${String(b).padStart(2, "0")}-${String(a).padStart(2, "0")}`;
    }
    // Default to US format: MM/DD/YYYY
    return `${year}-${String(a).padStart(2, "0")}-${String(b).padStart(2, "0")}`;
  }

  throw new Error(`Unrecognized date format: "${raw}"`);
}

// ---------------------------------------------------------------------------
// Amount normalization
// ---------------------------------------------------------------------------

/**
 * Normalize an amount string to integer cents.
 * Handles: currency symbols ($, €, £), commas, parenthesized negatives,
 * and plain decimal numbers.
 */
export function normalizeAmount(raw: string, currencyCode = "USD"): number {
  let cleaned = raw.trim();

  // Handle parenthesized negatives: (1234.56) → -1234.56
  const parenMatch = cleaned.match(/^\((.+)\)$/);
  if (parenMatch) {
    cleaned = `-${parenMatch[1]}`;
  }

  // Strip currency symbols and commas
  cleaned = cleaned.replace(/[$€£¥,]/g, "");

  // Remove whitespace
  cleaned = cleaned.replace(/\s/g, "");

  const value = parseFloat(cleaned);
  if (isNaN(value)) {
    throw new Error(`Cannot parse amount: "${raw}"`);
  }

  return toSmallestUnit(value, currencyCode);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a CSV string into normalized rows. Auto-detects header columns.
 * Throws if the CSV has no recognizable headers or no data rows.
 */
export function parseCSV(content: string): ParsedRow[] {
  const allRows = parseCSVLines(content);
  if (allRows.length < 2) {
    throw new Error("CSV must contain a header row and at least one data row");
  }

  const columns = detectColumns(allRows[0]!);
  if (!columns) {
    throw new Error(
      'CSV header must contain "date", "amount", and a payee column ("payee", "description", or "name")',
    );
  }

  const results: ParsedRow[] = [];

  for (let i = 1; i < allRows.length; i++) {
    const row = allRows[i]!;

    // Skip rows that are too short
    const maxIdx = Math.max(columns.date, columns.amount, columns.payee, columns.memo ?? 0);
    if (row.length <= maxIdx) continue;

    const dateRaw = row[columns.date]!;
    const amountRaw = row[columns.amount]!;
    const payeeRaw = row[columns.payee]!;
    const memoRaw = columns.memo !== null ? (row[columns.memo] ?? null) : null;

    // Skip empty rows
    if (!dateRaw && !amountRaw && !payeeRaw) continue;

    const date = normalizeDate(dateRaw);
    const amount = normalizeAmount(amountRaw);

    // Build rawData from all columns
    const rawData: Record<string, unknown> = {};
    for (let j = 0; j < row.length; j++) {
      const header = allRows[0]![j];
      if (header) {
        rawData[header] = row[j];
      }
    }

    results.push({
      date,
      amount,
      payee: payeeRaw.trim(),
      memo: memoRaw?.trim() || null,
      rawData,
    });
  }

  if (results.length === 0) {
    throw new Error("CSV contained no parseable data rows");
  }

  return results;
}

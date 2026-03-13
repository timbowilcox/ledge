// ---------------------------------------------------------------------------
// Merchant normalisation — resolve bank description variants to canonical
// merchant names using the merchant_aliases table.
// ---------------------------------------------------------------------------

import type { Database } from "../db/database.js";
import type { MerchantAlias, MerchantAliasRow } from "./types.js";
import { toMerchantAlias } from "./types.js";
import { generateId, nowUtc } from "../engine/id.js";

export interface AliasService {
  normalise(description: string): Promise<string>;
  addAlias(canonicalName: string, alias: string): Promise<MerchantAlias>;
  listAliases(): Promise<readonly MerchantAlias[]>;
}

export function createAliasService(db: Database): AliasService {
  return {
    /**
     * Normalise a bank description to its canonical merchant name.
     * 1. Trim and uppercase the description.
     * 2. Look up exact match in alias table.
     * 3. Return canonical_name if found, otherwise the cleaned description.
     */
    async normalise(description: string): Promise<string> {
      const cleaned = description.trim().toUpperCase();

      const row = await db.get<MerchantAliasRow>(
        "SELECT * FROM merchant_aliases WHERE UPPER(alias) = ?",
        [cleaned],
      );

      return row ? row.canonical_name : cleaned;
    },

    async addAlias(canonicalName: string, alias: string): Promise<MerchantAlias> {
      const id = generateId();
      const ts = nowUtc();

      await db.run(
        `INSERT INTO merchant_aliases (id, canonical_name, alias, created_at)
         VALUES (?, ?, ?, ?)`,
        [id, canonicalName, alias.trim().toUpperCase(), ts],
      );

      const row = await db.get<MerchantAliasRow>(
        "SELECT * FROM merchant_aliases WHERE id = ?",
        [id],
      );
      return toMerchantAlias(row!);
    },

    async listAliases(): Promise<readonly MerchantAlias[]> {
      const rows = await db.all<MerchantAliasRow>(
        "SELECT * FROM merchant_aliases ORDER BY canonical_name, alias",
      );
      return rows.map(toMerchantAlias);
    },
  };
}

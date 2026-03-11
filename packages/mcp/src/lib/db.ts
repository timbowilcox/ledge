// ---------------------------------------------------------------------------
// Database lifecycle: create in-memory SQLite, apply migrations, seed system user.
// Same pattern as packages/core/tests/engine.test.ts.
// ---------------------------------------------------------------------------

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SqliteDatabase, LedgerEngine } from "@ledge/core";
import type { Database } from "@ledge/core";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

const SYSTEM_USER_ID = "00000000-0000-7000-8000-000000000000";

/** Read a migration SQL file from the core package. */
function loadMigrationSql(filename: string): string {
  const migrationPath = resolve(
    __dirname,
    `../../../core/src/db/migrations/${filename}`,
  );
  return readFileSync(migrationPath, "utf-8");
}

export interface InitResult {
  engine: LedgerEngine;
  db: Database;
  systemUserId: string;
}

/**
 * Bootstrap an in-memory SQLite database with the Ledge schema and a system
 * user. Returns a ready-to-use engine.
 */
export async function initDatabase(): Promise<InitResult> {
  const db = await SqliteDatabase.create();

  // Apply schema — skip PRAGMA lines (already set by SqliteDatabase.create())
  const migration001 = loadMigrationSql("001_initial_schema.sqlite.sql");
  const schemaWithoutPragmas = migration001
    .split("\n")
    .filter((line) => !line.trim().startsWith("PRAGMA"))
    .join("\n");
  await db.exec(schemaWithoutPragmas);

  // Apply migration 002 — add 'updated' to audit_entries action CHECK
  const migration002 = loadMigrationSql("002_audit_action_updated.sqlite.sql");
  await db.exec(migration002);

  // Seed system user
  await db.run(
    `INSERT INTO users (id, email, name, auth_provider, auth_provider_id)
     VALUES (?, ?, ?, ?, ?)`,
    [SYSTEM_USER_ID, "system@ledge.local", "System", "system", "system"],
  );

  const engine = new LedgerEngine(db);

  return { engine, db, systemUserId: SYSTEM_USER_ID };
}

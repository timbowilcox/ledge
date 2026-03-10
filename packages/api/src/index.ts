// ---------------------------------------------------------------------------
// @ledge/api — Server entry point.
//
// Creates a SQLite database, applies migrations, initializes the engine,
// builds the Hono app, and starts the HTTP server.
//
// Environment variables:
//   PORT              — HTTP port (default: 3001)
//   LEDGE_DATA_DIR    — Directory for persistent SQLite file (default: in-memory)
//   LEDGE_ADMIN_SECRET — Admin secret for bootstrap operations
// ---------------------------------------------------------------------------

import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { SqliteDatabase, LedgerEngine } from "@ledge/core";
import { createApp } from "./app.js";

const main = async () => {
  const dataDir = process.env["LEDGE_DATA_DIR"];

  let db: SqliteDatabase;

  if (dataDir) {
    // Persistent mode — load existing DB or create new one
    mkdirSync(dataDir, { recursive: true });
    const dbPath = join(dataDir, "ledge.db");

    if (existsSync(dbPath)) {
      const data = readFileSync(dbPath);
      db = await SqliteDatabase.create(data);
      console.log(`Loaded existing database from ${dbPath}`);
    } else {
      db = await SqliteDatabase.create();
      applyMigrations(db);
      persistDatabase(db, dbPath);
      console.log(`Created new database at ${dbPath}`);
    }

    // Persist on graceful shutdown
    const shutdown = () => {
      console.log("Persisting database before shutdown...");
      persistDatabase(db, dbPath);
      process.exit(0);
    };
    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);

    // Periodic persistence every 60 seconds
    setInterval(() => {
      persistDatabase(db, dbPath);
    }, 60_000).unref();
  } else {
    // In-memory mode (dev/test)
    db = await SqliteDatabase.create();
    applyMigrations(db);
    console.log("Running with in-memory database (data will not persist)");
  }

  const engine = new LedgerEngine(db);
  const app = createApp(engine);

  const port = parseInt(process.env["PORT"] ?? "3001", 10);

  serve({ fetch: app.fetch, port, hostname: "0.0.0.0" }, (info) => {
    console.log(`@ledge/api listening on http://0.0.0.0:${info.port}`);
  });
};

/** Apply all SQLite migrations in order. */
const applyMigrations = (db: SqliteDatabase) => {
  const possiblePaths = [
    // Docker layout: packages/core/migrations/
    join(process.cwd(), "packages", "core", "migrations"),
    // Development: relative to this file's source location
    join(dirname(fileURLToPath(import.meta.url)), "..", "..", "core", "src", "db", "migrations"),
  ];

  let migrationsDir: string | undefined;
  for (const p of possiblePaths) {
    if (existsSync(p)) {
      migrationsDir = p;
      break;
    }
  }

  if (!migrationsDir) {
    console.warn("Migration files not found — schema must be applied manually");
    return;
  }

  const migrationFiles = [
    "001_initial_schema.sqlite.sql",
    "002_audit_action_updated.sqlite.sql",
  ];

  for (const file of migrationFiles) {
    const filePath = join(migrationsDir, file);
    if (existsSync(filePath)) {
      const sql = readFileSync(filePath, "utf-8");
      db.exec(sql);
      console.log(`Applied migration: ${file}`);
    }
  }
};

/** Write the database to disk. */
const persistDatabase = (db: SqliteDatabase, path: string) => {
  const data = db.export();
  writeFileSync(path, Buffer.from(data));
};

main().catch(console.error);

// Re-export the app factory for testing
export { createApp } from "./app.js";

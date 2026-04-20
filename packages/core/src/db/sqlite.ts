// ---------------------------------------------------------------------------
// SQLite adapter - wraps sql.js to implement the Database interface.
// sql.js is a WASM-compiled SQLite; no native build dependencies.
// ---------------------------------------------------------------------------

import initSqlJs, { type SqlJsDatabase } from "sql.js";
import { AsyncLocalStorage } from "node:async_hooks";
import type { Database, RunResult } from "./database.js";

export class SqliteDatabase implements Database {
  private constructor(private db: SqlJsDatabase) {}

  // Per-async-context transaction depth. Using AsyncLocalStorage instead of an
  // instance variable means concurrent operations on the same DB don't corrupt
  // each other's depth counter. (Mirrors the pattern in PostgresDatabase.)
  private depthStorage = new AsyncLocalStorage<{ depth: number }>();

  /**
   * Create a new in-memory SQLite database (for tests) or from a file path.
   * sql.js uses WASM so we need an async factory.
   */
  static async create(data?: ArrayLike<number>): Promise<SqliteDatabase> {
    const SQL = await initSqlJs();
    const db = data ? new SQL.Database(data) : new SQL.Database();
    const instance = new SqliteDatabase(db);
    // Enable WAL and foreign keys
    await instance.exec("PRAGMA journal_mode = WAL;");
    await instance.exec("PRAGMA foreign_keys = ON;");
    return instance;
  }

  async run(sql: string, params?: unknown[]): Promise<RunResult> {
    this.db.run(sql, params);
    const changes = this.db.getRowsModified();
    return { changes };
  }

  async get<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | undefined> {
    const stmt = this.db.prepare(sql);
    if (params) {
      stmt.bind(params);
    }
    if (stmt.step()) {
      const row = stmt.getAsObject() as T;
      stmt.free();
      return row;
    }
    stmt.free();
    return undefined;
  }

  async all<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]> {
    const stmt = this.db.prepare(sql);
    if (params) {
      stmt.bind(params);
    }
    const rows: T[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as T);
    }
    stmt.free();
    return rows;
  }

  async exec(sql: string): Promise<void> {
    this.db.exec(sql);
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    const ctx = this.depthStorage.getStore();

    if (ctx) {
      // Nested transaction within the same async context — use SAVEPOINT.
      ctx.depth++;
      const savepoint = `sp_${ctx.depth}`;
      await this.run(`SAVEPOINT ${savepoint}`);
      try {
        const result = await fn();
        await this.run(`RELEASE SAVEPOINT ${savepoint}`);
        return result;
      } catch (e) {
        await this.run(`ROLLBACK TO SAVEPOINT ${savepoint}`);
        throw e;
      } finally {
        ctx.depth--;
      }
    }

    // Top-level transaction — establish a new async-local depth context.
    return this.depthStorage.run({ depth: 1 }, async () => {
      await this.run("BEGIN IMMEDIATE");
      try {
        const result = await fn();
        await this.run("COMMIT");
        return result;
      } catch (e) {
        await this.run("ROLLBACK");
        throw e;
      }
    });
  }

  async close(): Promise<void> {
    this.db.close();
  }

  /** Export the database as a Uint8Array (for persistence). */
  export(): Uint8Array {
    return this.db.export();
  }
}

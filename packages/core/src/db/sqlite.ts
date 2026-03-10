// ---------------------------------------------------------------------------
// SQLite adapter — wraps sql.js to implement the Database interface.
// sql.js is a WASM-compiled SQLite; no native build dependencies.
// ---------------------------------------------------------------------------

import initSqlJs, { type SqlJsDatabase } from "sql.js";
import type { Database, RunResult } from "./database.js";

export class SqliteDatabase implements Database {
  private constructor(private db: SqlJsDatabase) {}

  /**
   * Create a new in-memory SQLite database (for tests) or from a file path.
   * sql.js uses WASM so we need an async factory.
   */
  static async create(data?: ArrayLike<number>): Promise<SqliteDatabase> {
    const SQL = await initSqlJs();
    const db = data ? new SQL.Database(data) : new SQL.Database();
    const instance = new SqliteDatabase(db);
    // Enable WAL and foreign keys
    instance.exec("PRAGMA journal_mode = WAL;");
    instance.exec("PRAGMA foreign_keys = ON;");
    return instance;
  }

  run(sql: string, params?: unknown[]): RunResult {
    this.db.run(sql, params);
    const changes = this.db.getRowsModified();
    return { changes };
  }

  get<T = Record<string, unknown>>(sql: string, params?: unknown[]): T | undefined {
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

  all<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[] {
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

  exec(sql: string): void {
    this.db.exec(sql);
  }

  private transactionDepth = 0;

  transaction<T>(fn: () => T): T {
    if (this.transactionDepth > 0) {
      // Nested transaction — use SAVEPOINT
      const savepoint = `sp_${this.transactionDepth}`;
      this.run(`SAVEPOINT ${savepoint}`);
      this.transactionDepth++;
      try {
        const result = fn();
        this.run(`RELEASE SAVEPOINT ${savepoint}`);
        this.transactionDepth--;
        return result;
      } catch (e) {
        this.run(`ROLLBACK TO SAVEPOINT ${savepoint}`);
        this.transactionDepth--;
        throw e;
      }
    }

    // Top-level transaction
    this.run("BEGIN IMMEDIATE");
    this.transactionDepth++;
    try {
      const result = fn();
      this.run("COMMIT");
      this.transactionDepth--;
      return result;
    } catch (e) {
      this.run("ROLLBACK");
      this.transactionDepth--;
      throw e;
    }
  }

  close(): void {
    this.db.close();
  }

  /** Export the database as a Uint8Array (for persistence). */
  export(): Uint8Array {
    return this.db.export();
  }
}

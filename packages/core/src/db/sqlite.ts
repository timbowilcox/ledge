// ---------------------------------------------------------------------------
// SQLite adapter - wraps sql.js to implement the Database interface.
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

  private transactionDepth = 0;

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    if (this.transactionDepth > 0) {
      // Nested transaction - use SAVEPOINT
      const savepoint = `sp_${this.transactionDepth}`;
      await this.run(`SAVEPOINT ${savepoint}`);
      this.transactionDepth++;
      try {
        const result = await fn();
        await this.run(`RELEASE SAVEPOINT ${savepoint}`);
        this.transactionDepth--;
        return result;
      } catch (e) {
        await this.run(`ROLLBACK TO SAVEPOINT ${savepoint}`);
        this.transactionDepth--;
        throw e;
      }
    }

    // Top-level transaction
    await this.run("BEGIN IMMEDIATE");
    this.transactionDepth++;
    try {
      const result = await fn();
      await this.run("COMMIT");
      this.transactionDepth--;
      return result;
    } catch (e) {
      await this.run("ROLLBACK");
      this.transactionDepth--;
      throw e;
    }
  }

  async close(): Promise<void> {
    this.db.close();
  }

  /** Export the database as a Uint8Array (for persistence). */
  export(): Uint8Array {
    return this.db.export();
  }
}

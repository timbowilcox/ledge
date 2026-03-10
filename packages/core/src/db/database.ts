// ---------------------------------------------------------------------------
// Database — abstract interface for SQLite (local/self-hosted) and PostgreSQL.
// The engine codes against this interface; adapters handle the specifics.
// ---------------------------------------------------------------------------

export type Row = Record<string, unknown>;

export interface RunResult {
  readonly changes: number;
  readonly lastInsertRowid?: number | bigint;
}

export interface Database {
  /** Execute a statement that returns no rows (DDL, INSERT, UPDATE, DELETE). */
  run(sql: string, params?: unknown[]): RunResult;

  /** Execute a query and return the first matching row, or undefined. */
  get<T = Row>(sql: string, params?: unknown[]): T | undefined;

  /** Execute a query and return all matching rows. */
  all<T = Row>(sql: string, params?: unknown[]): T[];

  /** Execute raw SQL (multiple statements, no params). Used for migrations. */
  exec(sql: string): void;

  /**
   * Run a function inside a database transaction.
   * If the function throws, the transaction is rolled back.
   * If it returns, the transaction is committed.
   */
  transaction<T>(fn: () => T): T;

  /** Close the database connection. */
  close(): void;
}

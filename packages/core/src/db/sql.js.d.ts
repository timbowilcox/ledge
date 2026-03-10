// Minimal type declarations for sql.js
declare module "sql.js" {
  export interface SqlJsStatic {
    Database: new (data?: ArrayLike<number>) => SqlJsDatabase;
  }

  export interface SqlJsDatabase {
    run(sql: string, params?: BindParams): void;
    exec(sql: string): QueryExecResult[];
    prepare(sql: string): Statement;
    getRowsModified(): number;
    close(): void;
    export(): Uint8Array;
  }

  export interface Statement {
    bind(params?: BindParams): boolean;
    step(): boolean;
    getAsObject(): Record<string, unknown>;
    free(): void;
  }

  export interface QueryExecResult {
    columns: string[];
    values: unknown[][];
  }

  export type BindParams = unknown[] | Record<string, unknown>;

  export default function initSqlJs(config?: Record<string, unknown>): Promise<SqlJsStatic>;
}

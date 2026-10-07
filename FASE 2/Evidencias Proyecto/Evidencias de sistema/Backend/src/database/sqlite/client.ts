import { DatabaseSync, StatementSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import { sqliteConfig } from '../../config/database.config';
import { logger } from '../../utils/logger';

export interface SqliteRunResult {
  changes: number | bigint;
  lastInsertRowid: number | bigint;
}

export class SqliteClient {
  private db: DatabaseSync;
  private inMemory: boolean;

  constructor(customPath?: string, inMemoryOverride?: boolean) {
    this.inMemory = inMemoryOverride !== undefined ? inMemoryOverride : sqliteConfig.inMemory;
    const dbPath = customPath || sqliteConfig.filename;

    if (this.inMemory) {
      this.db = new DatabaseSync(':memory:');
      logger.info('SqliteClient', 'Initialized SQLite in-memory database');
    } else {
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      this.db = new DatabaseSync(dbPath);
      logger.info('SqliteClient', `Initialized SQLite database at: ${dbPath}`);
    }

    if (sqliteConfig.foreignKeys) {
      this.db.exec('PRAGMA foreign_keys = ON;');
    }

    if (!this.inMemory && sqliteConfig.walMode) {
      this.db.exec('PRAGMA journal_mode = WAL;');
    }
  }

  public query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
    const start = Date.now();
    try {
      const stmt: StatementSync = this.db.prepare(sql);
      const rows = stmt.all(...(params as any[])) as unknown as T[];
      const duration = Date.now() - start;
      logger.debug('SqliteClient', 'Query executed', { sql, duration, count: rows.length });
      return rows;
    } catch (error) {
      logger.error('SqliteClient', 'Query execution failed', error, { sql, params });
      throw error;
    }
  }

  public queryOne<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T | undefined {
    const start = Date.now();
    try {
      const stmt: StatementSync = this.db.prepare(sql);
      const row = stmt.get(...(params as any[])) as unknown as T | undefined;
      const duration = Date.now() - start;
      logger.debug('SqliteClient', 'QueryOne executed', { sql, duration });
      return row;
    } catch (error) {
      logger.error('SqliteClient', 'QueryOne execution failed', error, { sql, params });
      throw error;
    }
  }

  public execute(sql: string, params: unknown[] = []): SqliteRunResult {
    const start = Date.now();
    try {
      const stmt: StatementSync = this.db.prepare(sql);
      const result = stmt.run(...(params as any[]));
      const duration = Date.now() - start;
      logger.debug('SqliteClient', 'Statement executed', { sql, duration, changes: result.changes });
      return {
        changes: result.changes,
        lastInsertRowid: result.lastInsertRowid
      };
    } catch (error) {
      logger.error('SqliteClient', 'Statement execution failed', error, { sql, params });
      throw error;
    }
  }

  public execRaw(sql: string): void {
    const start = Date.now();
    try {
      this.db.exec(sql);
      const duration = Date.now() - start;
      logger.debug('SqliteClient', 'Raw SQL executed', { duration });
    } catch (error) {
      logger.error('SqliteClient', 'Raw SQL execution failed', error);
      throw error;
    }
  }

  public withTransaction<T>(callback: () => T): T {
    const start = Date.now();
    this.db.exec('BEGIN TRANSACTION;');
    try {
      const result = callback();
      this.db.exec('COMMIT;');
      const duration = Date.now() - start;
      logger.debug('SqliteClient', 'Transaction committed', { duration });
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK;');
      logger.error('SqliteClient', 'Transaction rolled back due to error', error);
      throw error;
    }
  }

  public healthCheck(): boolean {
    try {
      const row = this.queryOne<{ alive: number }>('SELECT 1 as alive');
      return !!row && row.alive === 1;
    } catch (error) {
      logger.error('SqliteClient', 'Health check failed', error);
      return false;
    }
  }

  public close(): void {
    this.db.close();
    logger.info('SqliteClient', 'SQLite database connection closed');
  }

  public getRawDb(): DatabaseSync {
    return this.db;
  }
}

export const defaultSqliteClient = new SqliteClient();

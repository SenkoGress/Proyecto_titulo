import fs from 'fs';
import path from 'path';
import { SqliteClient } from './client';
import { logger } from '../../utils/logger';

export class SqliteMigrator {
  private client: SqliteClient;
  private migrationsDir: string;

  constructor(client: SqliteClient, customMigrationsDir?: string) {
    this.client = client;
    if (customMigrationsDir) {
      this.migrationsDir = customMigrationsDir;
    } else {
      const srcDir = path.resolve(process.cwd(), 'backend/src/database/sqlite/migrations');
      const distDir = path.resolve(__dirname, 'migrations');
      if (fs.existsSync(srcDir) && fs.readdirSync(srcDir).some(f => f.endsWith('.sql'))) {
        this.migrationsDir = srcDir;
      } else if (fs.existsSync(distDir) && fs.readdirSync(distDir).some(f => f.endsWith('.sql'))) {
        this.migrationsDir = distDir;
      } else {
        this.migrationsDir = srcDir;
      }
    }
  }

  public initMigrationTable(): void {
    this.client.execRaw(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
  }

  public getAppliedMigrations(): string[] {
    this.initMigrationTable();
    const rows = this.client.query<{ name: string }>(
      'SELECT name FROM _migrations ORDER BY id ASC'
    );
    return rows.map((r) => r.name);
  }

  public migrate(): string[] {
    this.initMigrationTable();
    const applied = this.getAppliedMigrations();

    if (!fs.existsSync(this.migrationsDir)) {
      throw new Error(`Migrations directory not found: ${this.migrationsDir}`);
    }

    const files = fs
      .readdirSync(this.migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    const pending = files.filter((file) => !applied.includes(file));
    const newlyApplied: string[] = [];

    for (const file of pending) {
      const filePath = path.join(this.migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');

      logger.info('SqliteMigrator', `Applying SQLite migration: ${file}`);

      this.client.withTransaction(() => {
        this.client.execRaw(sql);
        this.client.execute('INSERT INTO _migrations (name) VALUES (?)', [file]);
      });

      newlyApplied.push(file);
      logger.info('SqliteMigrator', `Successfully applied SQLite migration: ${file}`);
    }

    return newlyApplied;
  }
}

import fs from 'fs';
import path from 'path';
import { PostgresClient } from './client';
import { logger } from '../../utils/logger';

export class PostgresMigrator {
  private client: PostgresClient;
  private migrationsDir: string;

  constructor(client: PostgresClient, customMigrationsDir?: string) {
    this.client = client;
    if (customMigrationsDir) {
      this.migrationsDir = customMigrationsDir;
    } else {
      const srcDir = path.resolve(process.cwd(), 'backend/src/database/postgres/migrations');
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

  public async initMigrationTable(): Promise<void> {
    await this.client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
  }

  public async getAppliedMigrations(): Promise<string[]> {
    await this.initMigrationTable();
    const result = await this.client.query<{ name: string }>(
      'SELECT name FROM _migrations ORDER BY id ASC'
    );
    return result.rows.map((row) => row.name);
  }

  public async migrate(): Promise<string[]> {
    await this.initMigrationTable();
    const applied = await this.getAppliedMigrations();

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

      logger.info('PostgresMigrator', `Applying migration: ${file}`);

      await this.client.withTransaction(async (client) => {
        await client.query(sql);
        await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
      });

      newlyApplied.push(file);
      logger.info('PostgresMigrator', `Successfully applied migration: ${file}`);
    }

    return newlyApplied;
  }
}

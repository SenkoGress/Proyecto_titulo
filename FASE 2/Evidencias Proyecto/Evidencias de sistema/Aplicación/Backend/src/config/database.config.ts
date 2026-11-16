import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export interface PostgresConfig {
  connectionString?: string;
  host: string;
  port: number;
  user: string;
  password?: string;
  database: string;
  ssl: boolean;
  maxConnections: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
}

export interface SqliteConfig {
  filename: string;
  inMemory: boolean;
  walMode: boolean;
  foreignKeys: boolean;
}

export const postgresConfig: PostgresConfig = {
  connectionString: process.env.DATABASE_URL,
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432', 10),
  user: process.env.PGUSER || 'gestock_admin',
  password: process.env.PGPASSWORD || 'gestock_secret_2026',
  database: process.env.PGDATABASE || 'gestock_cloud_db',
  ssl: process.env.PGSSL === 'true',
  maxConnections: parseInt(process.env.PG_MAX_CONN || '20', 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
};

export const sqliteConfig: SqliteConfig = {
  filename: process.env.SQLITE_DB_PATH || path.resolve(process.cwd(), 'data', 'gestock_local_pos.sqlite'),
  inMemory: process.env.SQLITE_IN_MEMORY === 'true' || process.env.NODE_ENV === 'test',
  walMode: true,
  foreignKeys: true
};

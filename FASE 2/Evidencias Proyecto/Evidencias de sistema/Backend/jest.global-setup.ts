import { Client } from 'pg';

/** Crea la base de pruebas cuando se pide el PostgreSQL real (ver jest.setup.ts). */
export default async function crearBaseDePruebas(): Promise<void> {
  if (process.env.USE_REAL_PG !== 'true') return;

  const nombre = process.env.PGDATABASE_TEST || 'gestock_test_db';
  if (!/^[a-z_][a-z0-9_]*$/.test(nombre)) {
    throw new Error(`Nombre de base de pruebas no valido: ${nombre}`);
  }

  const admin = new Client({
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT || '5432', 10),
    user: process.env.PGUSER || 'gestock_admin',
    password: process.env.PGPASSWORD || 'gestock_secret_2026',
    database: 'postgres'
  });
  await admin.connect();
  try {
    const existe = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [nombre]);
    if (existe.rowCount === 0) await admin.query(`CREATE DATABASE ${nombre}`);
  } finally {
    await admin.end();
  }
}

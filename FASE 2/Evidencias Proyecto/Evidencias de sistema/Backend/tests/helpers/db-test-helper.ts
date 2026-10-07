import { newDb } from 'pg-mem';
import { v4 as uuidv4 } from 'uuid';
import { PostgresClient } from '../../src/database/postgres/client';
import { PostgresMigrator } from '../../src/database/postgres/migrator';
import { SqliteClient } from '../../src/database/sqlite/client';
import { SqliteMigrator } from '../../src/database/sqlite/migrator';
import path from 'path';

export async function createTestPostgresClient(): Promise<{ client: PostgresClient; migrator: PostgresMigrator }> {
  if (process.env.USE_REAL_PG === 'true') {
    try {
      const realClient = new PostgresClient();
      const isHealthy = await realClient.healthCheck(500);

      if (isHealthy) {
        const migrator = new PostgresMigrator(
          realClient,
          path.resolve(__dirname, '../../src/database/postgres/migrations')
        );
        await migrator.migrate();
        return { client: realClient, migrator };
      }
    } catch {
      // If connection to real Postgres fails, proceed with in-memory pg-mem
    }
  }

  const mem = newDb({
    autoCreateForeignKeyIndices: true,
    noAstCoverageCheck: true
  });

  mem.registerExtension('uuid-ossp', () => {});
  mem.registerExtension('pgcrypto', () => {});
  mem.registerLanguage('plpgsql', () => () => {});

  mem.public.registerFunction({
    name: 'gen_random_uuid',
    impure: true,
    implementation: () => uuidv4()
  });

  mem.public.registerFunction({
    name: 'uuid_generate_v4',
    impure: true,
    implementation: () => uuidv4()
  });

  const pgAdapter = mem.adapters.createPg();
  const pool = new pgAdapter.Pool();

  const client = new PostgresClient(pool);
  const originalWithTx = client.withTransaction.bind(client);
  client.withTransaction = async <T>(cb: (c: any) => Promise<T>): Promise<T> => {
    const backup = mem.backup();
    try {
      return await originalWithTx(cb);
    } catch (err) {
      backup.restore();
      throw err;
    }
  };

  const migrator = new PostgresMigrator(
    client,
    path.resolve(__dirname, '../../src/database/postgres/migrations')
  );

  await migrator.migrate();
  return { client, migrator };
}

export function createTestSqliteClient(): { client: SqliteClient; migrator: SqliteMigrator } {
  const client = new SqliteClient(':memory:', true);
  const migrator = new SqliteMigrator(
    client,
    path.resolve(__dirname, '../../src/database/sqlite/migrations')
  );
  migrator.migrate();
  return { client, migrator };
}

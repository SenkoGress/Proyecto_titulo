import { newDb } from 'pg-mem';
import { v4 as uuidv4 } from 'uuid';
import { PostgresClient } from '../../src/database/postgres/client';
import { PostgresMigrator } from '../../src/database/postgres/migrator';
import { SqliteClient } from '../../src/database/sqlite/client';
import { SqliteMigrator } from '../../src/database/sqlite/migrator';
import path from 'path';

export async function createTestPostgresClient(): Promise<{ client: PostgresClient; migrator: PostgresMigrator }> {
  // Pedir PostgreSQL real y recibir pg-mem en silencio hacia que una suite corriera sobre un
  // motor distinto al del resto de la corrida, sin dejar rastro. Asi se oculto durante dos
  // ejecuciones una sentencia valida en PostgreSQL que pg-mem no implementa: la suite que caia
  // al motor en memoria fallaba, las demas pasaban, y el fallo parecia intermitente.
  // Si se pidio el motor real y no esta disponible, la corrida se detiene y lo dice.
  if (process.env.USE_REAL_PG === 'true') {
    const realClient = new PostgresClient();
    let detalle = '';
    let isHealthy = false;

    try {
      // Un contenedor recien levantado puede tardar mas de medio segundo en contestar
      isHealthy = await realClient.healthCheck(5000);
    } catch (err) {
      detalle = err instanceof Error ? err.message : String(err);
    }

    if (!isHealthy) {
      throw new Error(
        'USE_REAL_PG=true pero PostgreSQL no respondio la sonda de salud. La corrida se detiene ' +
          'en vez de continuar sobre el motor en memoria, porque eso haria pasar por verificado ' +
          'contra PostgreSQL algo que no lo esta. Levante el contenedor o quite USE_REAL_PG. ' +
          (detalle ? `Detalle: ${detalle}` : '')
      );
    }

    const migrator = new PostgresMigrator(
      realClient,
      path.resolve(__dirname, '../../src/database/postgres/migrations')
    );
    await migrator.migrate();
    return { client: realClient, migrator };
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

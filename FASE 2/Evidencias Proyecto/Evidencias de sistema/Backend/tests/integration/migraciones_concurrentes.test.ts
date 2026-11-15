import fs from 'fs';
import os from 'os';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { PostgresClient } from '../../src/database/postgres/client';
import { PostgresMigrator } from '../../src/database/postgres/migrator';
import { createTestPostgresClient } from '../helpers/db-test-helper';

/**
 * Dos cajas que arrancan a la vez despues de una actualizacion aplican la misma migracion en la
 * misma nube. Solo corre con USE_REAL_PG=true: pg-mem no aisla transacciones ni hace esperar un
 * INSERT sobre una clave unica, asi que alli no hay carrera que probar.
 */
const conPostgresReal = process.env.USE_REAL_PG === 'true' ? test : test.skip;

describe('Migraciones de la nube con dos cajas arrancando a la vez', () => {
  let client: PostgresClient;
  let dir: string;
  const tabla = `carrera_${uuidv4().replace(/-/g, '').slice(0, 12)}`;

  beforeAll(async () => {
    client = (await createTestPostgresClient()).client;
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gestock-migr-'));
    fs.writeFileSync(path.join(dir, `999_${tabla}.sql`),
      `CREATE TABLE ${tabla} (id INTEGER); INSERT INTO ${tabla} VALUES (1);`);
  });

  afterAll(async () => {
    await client.query(`DROP TABLE IF EXISTS ${tabla}`);
    await client.query('DELETE FROM _migrations WHERE name = $1', [`999_${tabla}.sql`]);
    fs.rmSync(dir, { recursive: true, force: true });
    await client.close();
  });

  conPostgresReal('las dos terminan bien y la migracion se aplica una sola vez', async () => {
    const resultados = await Promise.allSettled([
      new PostgresMigrator(client, dir).migrate(),
      new PostgresMigrator(client, dir).migrate(),
    ]);

    expect(resultados.map((r) => r.status)).toEqual(['fulfilled', 'fulfilled']);
    const aplicadas = resultados.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
    expect(aplicadas).toEqual([`999_${tabla}.sql`]);
    const filas = await client.query<{ n: string }>(`SELECT COUNT(*) AS n FROM ${tabla}`);
    expect(Number(filas.rows[0].n)).toBe(1);
  });
});

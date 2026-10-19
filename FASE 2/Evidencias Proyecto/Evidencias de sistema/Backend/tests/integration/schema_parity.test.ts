import { PostgresClient } from '../../src/database/postgres/client';
import { SqliteClient } from '../../src/database/sqlite/client';
import { createTestPostgresClient, createTestSqliteClient } from '../helpers/db-test-helper';

/**
 * La documentacion afirmaba "29 tablas relacionales" y ninguna prueba contaba tablas: la nube
 * estuvo tres semanas sin la tabla `mermas` sin que nada lo detectara. Se agrego a 001 despues de
 * que la base ya tenia esa migracion registrada, asi que la sentencia no volvio a ejecutarse.
 *
 * Esta suite no afirma un numero. Compara los dos esquemas entre si, porque el requisito real es
 * que el espejo local y la nube tengan las mismas tablas, no que sean una cantidad determinada.
 */

/**
 * Divergencias deliberadas entre motores. Vacio a proposito: hoy no hay ninguna justificada.
 * Agregar algo aqui obliga a escribir por que, y deja el motivo a la vista en la revision.
 */
const DIVERGENCIAS_ACEPTADAS: Record<string, string> = {};

describe('Paridad de Esquema entre el Nodo Local y la Nube', () => {
  let pgClient: PostgresClient;
  let sqliteClient: SqliteClient;

  beforeAll(async () => {
    const pgSetup = await createTestPostgresClient();
    pgClient = pgSetup.client;
    sqliteClient = createTestSqliteClient().client;
  });

  afterAll(async () => {
    await pgClient.close();
  });

  async function tablasNube(): Promise<string[]> {
    const res = await pgClient.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
    );
    return res.rows.map((r) => r.table_name).sort();
  }

  function tablasLocales(): string[] {
    const filas = sqliteClient.query<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`
    );
    return filas.map((f) => f.name).sort();
  }

  test('1. Toda tabla del nodo local existe en la nube', async () => {
    const nube = new Set(await tablasNube());
    const faltantes = tablasLocales().filter(
      (t) => !nube.has(t) && !(t in DIVERGENCIAS_ACEPTADAS)
    );

    // Una tabla que solo existe en el local no tiene destino al sincronizar: lo que la caja
    // registre sin conexion se queda ahi para siempre, y el administrador nunca lo ve
    expect(faltantes).toEqual([]);
  });

  test('2. Toda tabla de la nube existe en el nodo local', async () => {
    const locales = new Set(tablasLocales());
    const faltantes = (await tablasNube()).filter(
      (t) => !locales.has(t) && !(t in DIVERGENCIAS_ACEPTADAS)
    );

    // Y al contrario: una tabla que solo existe en la nube rompe la operacion sin conexion,
    // porque el terminal no tiene donde escribir cuando el circuito esta abierto
    expect(faltantes).toEqual([]);
  });

  test('3. La tabla de mermas llega a los dos motores', async () => {
    // Caso que origino esta suite: presente en el local desde 001, ausente en la nube porque
    // la sentencia se agrego a 001 cuando esa migracion ya estaba registrada como aplicada
    expect(tablasLocales()).toContain('mermas');
    expect(await tablasNube()).toContain('mermas');
  });

  test('4. Ambos motores comparten la tabla de control de migraciones', async () => {
    expect(tablasLocales()).toContain('_migrations');
    expect(await tablasNube()).toContain('_migrations');
  });

  test('5. El recuento de tablas coincide entre los dos motores', async () => {
    const nube = await tablasNube();
    const locales = tablasLocales();

    // Se compara el conjunto, no una cifra fija: asi la prueba no hay que editarla cada vez
    // que el modelo crece, y sigue fallando si una migracion llega a un solo motor
    expect(locales.length - Object.keys(DIVERGENCIAS_ACEPTADAS).length).toBe(nube.length);
  });

  test('6. Ninguna tabla auxiliar de migracion queda viva', async () => {
    const sospechosas = /(_nueva|_respaldo|_tmp|_old|_backup)$/;
    const residuos = [...(await tablasNube()), ...tablasLocales()].filter((t) =>
      sospechosas.test(t)
    );

    // Las migraciones que reconstruyen una tabla crean una auxiliar y la renombran: si alguna
    // quedo a medio camino, el esquema arrastra una copia con datos viejos
    expect(residuos).toEqual([]);
  });
});

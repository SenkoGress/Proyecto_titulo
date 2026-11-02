import { createTestPostgresClient, createTestSqliteClient } from '../helpers/db-test-helper';
import { PostgresClient } from '../../src/database/postgres/client';
import { SqliteClient } from '../../src/database/sqlite/client';

const TENANT = '00000000-0000-0000-0000-000000000001';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * El historial de demostracion se sembraba solo en el nodo local, y con identificadores del tipo
 * v1-<uuid del producto> que PostgreSQL rechaza por no ser UUID. El resultado era un historial
 * local que la nube no podia recibir y que tampoco existia arriba: el equipo de interfaz lo
 * midio contra PostgreSQL real y vio que la nube arrancaba dias despues que el terminal.
 *
 * Esta suite comprueba las dos mitades contra los dos motores: que la forma del identificador
 * sea la que la nube acepta, y que las sentencias de la siembra corran en PostgreSQL.
 */
describe('Pruebas de Integracion: Siembra del Historial en los Dos Motores', () => {
  let pg: PostgresClient;
  let sqlite: SqliteClient;

  beforeAll(async () => {
    const cloud = await createTestPostgresClient();
    pg = cloud.client;
    await cloud.migrator.migrate();

    const local = createTestSqliteClient();
    sqlite = local.client;
    local.migrator.migrate();
  });

  /** Las mismas sentencias de la siembra, con los mismos identificadores derivados. */
  const PRODUCTO = '33333333-0000-0000-0000-000000000001';
  const VENTA = `44444444${PRODUCTO.slice(8)}`;
  const DETALLE = `66666666${PRODUCTO.slice(8)}`;

  test('el identificador derivado del producto tiene forma de UUID en los dos motores', () => {
    expect(VENTA).toMatch(UUID);
    expect(DETALLE).toMatch(UUID);
    // Era `v1-${producto.id}`, que no la tiene
    expect(`v1-${PRODUCTO}`).not.toMatch(UUID);
  });

  test('PostgreSQL acepta la venta sembrada, su detalle y la repeticion del arranque', async () => {
    await pg.query(
      `INSERT INTO tenants (id, nombre, estado) VALUES ($1, 'Local de Prueba', 'ACTIVO')
       ON CONFLICT (id) DO NOTHING`,
      [TENANT]
    );
    await pg.query(
      `INSERT INTO usuarios (id, tenant_id, nombre, email, password_hash, rol)
       VALUES ($1, $2, 'Admin', 'admin@siembra.cl', $3, 'admin')
       ON CONFLICT (id) DO NOTHING`,
      ['77777777-0000-0000-0000-000000000001', TENANT, '$2a$10$' + 'x'.repeat(53)]
    );
    await pg.query(
      `INSERT INTO productos (id, tenant_id, sku, nombre, stock_actual, stock_minimo, precio_compra, precio_venta, activo)
       VALUES ($1, $2, 'BEB-CC-350', 'Coca Cola 350ml Lata', 45, 12, 500, 1000, true)
       ON CONFLICT (id) DO NOTHING`,
      [PRODUCTO, TENANT]
    );

    // Las dos sentencias que la siembra ejecuta en la nube, incluido el calculo de la fecha
    for (const pasada of [1, 2]) {
      await pg.query(
        `INSERT INTO transacciones_venta
         (id, tenant_id, usuario_id, folio_local_sqlite, total, unidades, estado, is_dirty, sync_status, fecha)
         VALUES ($1, $2, $3, $4, $5, 10, 'COMPLETADA', 0, 'SYNCED', NOW() - INTERVAL '2 days')
         ON CONFLICT (id) DO NOTHING`,
        [VENTA, TENANT, '77777777-0000-0000-0000-000000000001', 'FOLIO-HIST-BEB-CC-350', 10000]
      );
      await pg.query(
        `INSERT INTO detalle_venta (id, venta_id, producto_id, cantidad, precio_unitario, subtotal)
         VALUES ($1, $2, $3, 10, 1000, 10000)
         ON CONFLICT (id) DO NOTHING`,
        [DETALLE, VENTA, PRODUCTO]
      );
      expect(pasada).toBeLessThanOrEqual(2);
    }

    // Se consulta por el identificador exacto y no por el folio: una base de desarrollo puede
    // tener otras ventas del historial, y la prueba debe hablar solo de la fila que ella creo.
    const ventas = await pg.query<{ id: string }>(
      'SELECT id FROM transacciones_venta WHERE id = $1',
      [VENTA]
    );
    const detalles = await pg.query<{ id: string }>(
      'SELECT id FROM detalle_venta WHERE venta_id = $1',
      [VENTA]
    );

    // Una sola fila tras dos pasadas: el arranque repetido no duplica el historial
    expect(ventas.rows).toHaveLength(1);
    expect(ventas.rows[0].id).toBe(VENTA);
    expect(detalles.rows).toHaveLength(1);
  });

  test('SQLite acepta el mismo identificador, de modo que los dos extremos coinciden', () => {
    sqlite.execute(
      `INSERT OR IGNORE INTO tenants (id, nombre, estado) VALUES (?, 'Local de Prueba', 'ACTIVO')`,
      [TENANT]
    );
    sqlite.execute(
      `INSERT OR IGNORE INTO usuarios (id, tenant_id, nombre, email, password_hash, rol)
       VALUES (?, ?, 'Admin', 'admin@siembra.cl', ?, 'admin')`,
      ['77777777-0000-0000-0000-000000000001', TENANT, '$2a$10$' + 'x'.repeat(53)]
    );
    sqlite.execute(
      `INSERT OR IGNORE INTO productos (id, tenant_id, sku, nombre, stock_actual, stock_minimo, precio_compra, precio_venta, activo)
       VALUES (?, ?, 'BEB-CC-350', 'Coca Cola 350ml Lata', 45, 12, 500, 1000, 1)`,
      [PRODUCTO, TENANT]
    );
    sqlite.execute(
      `INSERT OR IGNORE INTO transacciones_venta
       (id, tenant_id, usuario_id, folio_local_sqlite, total, unidades, estado, is_dirty, sync_status, fecha)
       VALUES (?, ?, ?, 'FOLIO-HIST-BEB-CC-350', 10000, 10, 'COMPLETADA', 0, 'SYNCED', datetime('now', '-2 days'))`,
      [VENTA, TENANT, '77777777-0000-0000-0000-000000000001']
    );

    const fila = sqlite.queryOne<{ id: string }>(
      'SELECT id FROM transacciones_venta WHERE id = ?',
      [VENTA]
    );

    expect(fila?.id).toBe(VENTA);
  });
});

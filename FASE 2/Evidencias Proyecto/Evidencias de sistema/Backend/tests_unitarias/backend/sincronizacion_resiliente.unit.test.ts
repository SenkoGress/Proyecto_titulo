import { defaultSqliteClient } from '../../backend/src/database/sqlite/client';
import { initializeDatabase } from '../../backend/src/database/init-db';
import { defaultPgClient } from '../../backend/src/database/postgres/client';
import { PosSyncEngineService } from '../../backend/src/sync/pos-sync-engine.service';
import { SyncPushPayload, SyncPushResponse } from '../../backend/src/sync/types';

const TENANT = '00000000-0000-0000-0000-000000000001';
/** Se toma un usuario sembrado: inventar uno viola la clave foranea de la venta. */
let USUARIO = '';
const PRODUCTO = '00000000-0000-0000-0000-00000000pr01';
const PROVEEDOR = '00000000-0000-0000-0000-00000000pv01';
const VENTA_BUENA = '00000000-0000-0000-0000-00000000vt01';
const VENTA_MALA = '00000000-0000-0000-0000-00000000vt02';

/**
 * Tres defectos encadenados impedian sincronizar desde la caja, y el usuario solo veia un error
 * del motor de base de datos sin forma de avanzar:
 *
 *   1. todo el lote viajaba en una sola transaccion, de modo que una venta rechazada bloqueaba
 *      tambien a las correctas;
 *   2. la venta no llevaba consigo los productos que referencia, y un producto creado en el
 *      terminal y nunca replicado hacia imposible insertar su detalle en la nube;
 *   3. el mensaje devuelto no nombraba la causa.
 */
describe('Pruebas Unitarias: Resiliencia del Envio de Ventas a la Nube', () => {
  const motor = new PosSyncEngineService(defaultSqliteClient);

  beforeAll(async () => {
    defaultPgClient.tripCircuit();
    await initializeDatabase();

    const u = defaultSqliteClient.queryOne<{ id: string }>('SELECT id FROM usuarios LIMIT 1');
    if (!u) throw new Error('la siembra no dejo usuarios con los que registrar una venta');
    USUARIO = u.id;
  });

  beforeEach(() => {
    limpiar();
    defaultSqliteClient.execute(
      `INSERT OR IGNORE INTO proveedores (id, tenant_id, rut_proveedor, nombre_proveedores, email)
       VALUES (?, ?, '77.555.444-3', 'Distribuidora de Prueba', 'contacto@prueba.cl')`,
      [PROVEEDOR, TENANT]
    );
    defaultSqliteClient.execute(
      `INSERT OR IGNORE INTO productos (id, tenant_id, proveedor_id, sku, nombre, stock_actual, precio_compra, precio_venta, activo)
       VALUES (?, ?, ?, 'SKU-SYNC-01', 'Bolsa Reutilizable', 20, 300, 500, 1)`,
      [PRODUCTO, TENANT, PROVEEDOR]
    );
    for (const id of [VENTA_BUENA, VENTA_MALA]) {
      defaultSqliteClient.execute(
        `INSERT OR IGNORE INTO transacciones_venta
         (id, tenant_id, usuario_id, folio_local_sqlite, total, unidades, estado, is_dirty, sync_status, fecha)
         VALUES (?, ?, ?, ?, 1000, 1, 'COMPLETADA', 1, 'PENDING', datetime('now'))`,
        [id, TENANT, USUARIO, 'F-' + id.slice(-4)]
      );
      defaultSqliteClient.execute(
        `INSERT OR IGNORE INTO detalle_venta (id, venta_id, producto_id, cantidad, precio_unitario, subtotal)
         VALUES (?, ?, ?, 1, 500, 500)`,
        ['det-' + id.slice(-4), id, PRODUCTO]
      );
    }
  });

  afterAll(() => limpiar());

  function limpiar(): void {
    for (const id of [VENTA_BUENA, VENTA_MALA]) {
      defaultSqliteClient.execute('DELETE FROM detalle_venta WHERE venta_id = ?', [id]);
      defaultSqliteClient.execute('DELETE FROM transacciones_venta WHERE id = ?', [id]);
    }
    defaultSqliteClient.execute('DELETE FROM productos WHERE id = ?', [PRODUCTO]);
    defaultSqliteClient.execute('DELETE FROM proveedores WHERE id = ?', [PROVEEDOR]);
  }

  /** Acepta la primera venta y rechaza la segunda, como haria la nube ante un dato invalido. */
  function nubeQueRechazaUna(): (p: SyncPushPayload) => Promise<SyncPushResponse> {
    return async (payload) => {
      const venta = payload.sales[0];
      if (venta.sale.id === VENTA_MALA) {
        return {
          success: false,
          synced_ids: [],
          failed_ids: [venta.sale.id],
          processed_at: new Date().toISOString(),
          message: 'violates foreign key constraint "detalle_venta_producto_id_fkey"'
        };
      }
      return {
        success: true,
        synced_ids: [venta.sale.id],
        failed_ids: [],
        processed_at: new Date().toISOString(),
        message: 'ok'
      };
    };
  }

  test('1. Una venta rechazada no impide que las demas se sincronicen', async () => {
    const r = await motor.syncPush(TENANT, nubeQueRechazaUna());

    // Antes el lote completo se revertia y no se sincronizaba ninguna
    expect(r.synced_ids).toContain(VENTA_BUENA);
    expect(r.failed_ids).toContain(VENTA_MALA);
  });

  test('2. El resultado informa cuantas quedaron pendientes y por que', async () => {
    const r = await motor.syncPush(TENANT, nubeQueRechazaUna());

    expect(r.success).toBe(false);
    expect(r.message).toMatch(/1 de 2/);
    expect(r.message).toMatch(/foreign key/);
  });

  test('3. La venta sincronizada queda marcada como tal en el terminal', async () => {
    await motor.syncPush(TENANT, nubeQueRechazaUna());

    const buena = defaultSqliteClient.queryOne<{ is_dirty: number; sync_status: string }>(
      'SELECT is_dirty, sync_status FROM transacciones_venta WHERE id = ?',
      [VENTA_BUENA]
    );
    expect(Number(buena?.is_dirty)).toBe(0);
    expect(buena?.sync_status).toBe('SYNCED');
  });

  test('4. La venta lleva consigo los productos que su detalle referencia', () => {
    const pendientes = motor.getPendingDirtySales(TENANT);
    const item = pendientes.find((p) => p.sale.id === VENTA_BUENA);

    // Sin esto la nube no puede insertar el detalle de un producto que no conoce
    expect(item?.productos).toBeDefined();
    expect(item?.productos?.map((p) => p.id)).toContain(PRODUCTO);
    expect(item?.productos?.[0].nombre).toBe('Bolsa Reutilizable');
  });

  test('5. La venta lleva tambien el proveedor de esos productos', () => {
    const item = motor.getPendingDirtySales(TENANT).find((p) => p.sale.id === VENTA_BUENA);

    // Un producto declara proveedor_id: crearlo arriba sin su proveedor vuelve a fallar un
    // nivel mas arriba, o lo deja sin vinculo y la nube no puede agrupar reposicion
    expect(item?.proveedores?.map((p) => p.id)).toContain(PROVEEDOR);
    expect(item?.productos?.[0].proveedor_id).toBe(PROVEEDOR);
  });

  test('6. Sin ventas pendientes el envio no falla ni inventa trabajo', async () => {
    limpiar();

    const r = await motor.syncPush(TENANT, nubeQueRechazaUna());

    expect(r.success).toBe(true);
    expect(r.synced_ids).toEqual([]);
  });
});

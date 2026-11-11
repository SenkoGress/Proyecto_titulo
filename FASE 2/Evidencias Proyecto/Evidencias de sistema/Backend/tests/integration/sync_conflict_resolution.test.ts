import { PostgresClient } from '../../src/database/postgres/client';
import { SqliteClient } from '../../src/database/sqlite/client';
import { Producto } from '../../src/database/types';
import { CloudSyncReceiverService } from '../../src/sync/cloud-sync-receiver.service';
import { PosSyncEngineService } from '../../src/sync/pos-sync-engine.service';
import { createTestPostgresClient, createTestSqliteClient } from '../helpers/db-test-helper';
import {
  createFixtureIds,
  sampleMetodoPago,
  sampleProducto,
  sampleTenant,
  sampleUsuario
} from '../helpers/fixtures';

describe('Conflict Resolution Policies (Net Stock Delta & Catalog Primacy)', () => {
  let pgClient: PostgresClient;
  let sqliteClient: SqliteClient;
  let cloudReceiver: CloudSyncReceiverService;
  let posEngine: PosSyncEngineService;

  beforeAll(async () => {
    const pgSetup = await createTestPostgresClient();
    pgClient = pgSetup.client;
    cloudReceiver = new CloudSyncReceiverService(pgClient);

    const sqliteSetup = createTestSqliteClient();
    sqliteClient = sqliteSetup.client;
    posEngine = new PosSyncEngineService(sqliteClient);
  });

  afterAll(async () => {
    await pgClient.close();
    sqliteClient.close();
  });

  test('1. Resolución de Stock No Destructiva por Delta Neto No sobreescribe con el valor absoluto local', async () => {
    const ids = createFixtureIds();
    const tenant = sampleTenant(ids.tenantId);
    const user = sampleUsuario(ids.usuarioCajeroId, ids.tenantId, 'cajero');
    const prod = sampleProducto(ids.productoId, ids.tenantId);

    // Inicializar producto con stock 100 en la nube
    await pgClient.query(`INSERT INTO tenants (id, nombre, estado) VALUES ($1, $2, $3)`, [tenant.id, tenant.nombre, tenant.estado]);
    await pgClient.query(`INSERT INTO usuarios (id, tenant_id, nombre, email, password_hash, rol) VALUES ($1, $2, $3, $4, $5, $6)`, [user.id, user.tenant_id, user.nombre, user.email, user.password_hash, user.rol]);
    await pgClient.query(
      `INSERT INTO productos (id, tenant_id, sku, nombre, stock_actual, precio_compra, precio_venta)
       VALUES ($1, $2, $3, $4, 100.0, 500, 1000)`,
      [prod.id, prod.tenant_id, prod.sku, prod.nombre]
    );

    // El POS toma una foto local con stock 100 antes de perder la conexión
    sqliteClient.execute('INSERT INTO tenants (id, nombre, estado) VALUES (?, ?, ?)', [tenant.id, tenant.nombre, tenant.estado]);
    sqliteClient.execute('INSERT INTO usuarios (id, tenant_id, nombre, email, password_hash, rol) VALUES (?, ?, ?, ?, ?, ?)', [user.id, user.tenant_id, user.nombre, user.email, user.password_hash, user.rol]);
    sqliteClient.execute(
      `INSERT INTO productos (id, tenant_id, sku, nombre, stock_actual, precio_compra, precio_venta)
       VALUES (?, ?, ?, ?, 100.0, 500, 1000)`,
      [prod.id, prod.tenant_id, prod.sku, prod.nombre]
    );

    // ESCENARIO CONCURRENTE:
    // Mientras el POS está desconectado, en la nube ocurre una venta online o ajuste de 10 unidades.
    // Stock en nube pasa de 100 a 90.
    await pgClient.query(`UPDATE productos SET stock_actual = 90.0 WHERE id = $1`, [prod.id]);

    // En el POS fuera de línea se venden 4 unidades (el POS cree localmente que el stock queda en 96).
    const saleId = createFixtureIds().ventaId;
    sqliteClient.execute(
      `INSERT INTO transacciones_venta (id, tenant_id, usuario_id, folio_local_sqlite, total, unidades, estado, is_dirty, sync_status)
       VALUES (?, ?, ?, ?, 4000.0, 4.0, 'COMPLETADA', 1, 'PENDING')`,
      [saleId, ids.tenantId, ids.usuarioCajeroId, 'FOLIO-OFFLINE-DELTA']
    );
    sqliteClient.execute(
      `INSERT INTO detalle_venta (id, venta_id, producto_id, cantidad, precio_unitario, subtotal)
       VALUES (?, ?, ?, 4.0, 1000.0, 4000.0)`,
      [createFixtureIds().detalleVentaId, saleId, prod.id]
    );

    // El POS se reconecta y ejecuta sincronización Push hacia la Nube
    const pushResult = await posEngine.syncPush(ids.tenantId, async (payload) => {
      return cloudReceiver.ingestPushBatch(payload);
    });

    expect(pushResult.success).toBe(true);

    // VERIFICACIÓN CLAVE DE LA ARQUITECTURA:
    // El backend calcula la diferencia neta: delta = -4.
    // Nuevo stock en la nube = 90 (stock concurrente nube) - 4 (delta POS) = 86.
    // Si hubiese sobreescrito destructivamente con el saldo local del POS, habría quedado en 96 (perdiendo las 10 unidades de la nube).
    const cloudProd = await pgClient.query<{ stock_actual: string }>('SELECT stock_actual FROM productos WHERE id = $1', [prod.id]);
    expect(Number(cloudProd.rows[0].stock_actual)).toBe(86.0);

    // Verificar que en historial_stock se registró el cambio exacto de -4
    const historyRes = await pgClient.query<{ cambio: string; tipo_movimiento: string }>(
      'SELECT cambio, tipo_movimiento FROM historial_stock WHERE producto_id = $1 AND tenant_id = $2 ORDER BY fecha_movimiento DESC LIMIT 1',
      [prod.id, ids.tenantId]
    );
    expect(Number(historyRes.rows[0].cambio)).toBe(-4.0);
    expect(historyRes.rows[0].tipo_movimiento).toBe('venta');
  });

  test('2. Primacía de Catálogo de la Nube La nube manda en precios y productos', async () => {
    const ids = createFixtureIds();
    const tenant = sampleTenant(ids.tenantId);
    const prod = sampleProducto(ids.productoId, ids.tenantId);

    // Producto inicial en SQLite con precio de venta $1.000
    sqliteClient.execute('INSERT INTO tenants (id, nombre, estado) VALUES (?, ?, ?)', [tenant.id, tenant.nombre, tenant.estado]);
    sqliteClient.execute(
      `INSERT INTO productos (id, tenant_id, sku, nombre, stock_actual, precio_compra, precio_venta)
       VALUES (?, ?, ?, ?, 50.0, 500, 1000)`,
      [prod.id, prod.tenant_id, prod.sku, prod.nombre]
    );

    // En la nube el administrador modifica el precio a $1.490 y el nombre a versión actualizada
    await pgClient.query(`INSERT INTO tenants (id, nombre, estado) VALUES ($1, $2, $3)`, [tenant.id, tenant.nombre, tenant.estado]);
    await pgClient.query(
      `INSERT INTO productos (id, tenant_id, sku, nombre, stock_actual, precio_compra, precio_venta)
       VALUES ($1, $2, $3, 'Bebida Cola 1.5L Zero Azúcar', 50.0, 600, 1490)`,
      [prod.id, prod.tenant_id, prod.sku]
    );

    // El POS ejecuta Pull de Catálogo
    const updatedCount = await posEngine.syncPullCatalog(ids.tenantId, async (req) => {
      return cloudReceiver.getPullUpdates(req.tenant_id, req.last_pull_timestamp);
    });

    expect(updatedCount).toBe(1);

    // Comprobar que en SQLite el precio se actualizó a $1.490 y el nombre cambió ("La Nube manda en Catálogo")
    const localUpdated = sqliteClient.queryOne<Producto>(
      'SELECT precio_venta, precio_compra, nombre FROM productos WHERE id = ?',
      [prod.id]
    );

    expect(Number(localUpdated?.precio_venta)).toBe(1490);
    expect(Number(localUpdated?.precio_compra)).toBe(600);
    expect(localUpdated?.nombre).toBe('Bebida Cola 1.5L Zero Azúcar');
  });

  test('3. Una venta de un producto que la nube conoce con otro id y el mismo SKU sube contra el id de la nube', async () => {
    const ids = createFixtureIds();
    const tenant = sampleTenant(ids.tenantId);
    const user = sampleUsuario(ids.usuarioCajeroId, ids.tenantId, 'cajero');
    const idLocal = ids.productoId;
    const idNube = createFixtureIds().productoId;
    const sku = `SKU-FACTURA-${idLocal.slice(0, 8)}`;

    await pgClient.query(`INSERT INTO tenants (id, nombre, estado) VALUES ($1, $2, $3)`, [tenant.id, tenant.nombre, tenant.estado]);
    await pgClient.query(`INSERT INTO usuarios (id, tenant_id, nombre, email, password_hash, rol) VALUES ($1, $2, $3, $4, $5, $6)`, [user.id, user.tenant_id, user.nombre, user.email, user.password_hash, user.rol]);
    await pgClient.query(
      `INSERT INTO productos (id, tenant_id, sku, nombre, stock_actual, precio_compra, precio_venta)
       VALUES ($1, $2, $3, 'Crema de leche', 20.0, 500, 1000)`,
      [idNube, ids.tenantId, sku]
    );

    sqliteClient.execute('INSERT INTO tenants (id, nombre, estado) VALUES (?, ?, ?)', [tenant.id, tenant.nombre, tenant.estado]);
    sqliteClient.execute('INSERT INTO usuarios (id, tenant_id, nombre, email, password_hash, rol) VALUES (?, ?, ?, ?, ?, ?)', [user.id, user.tenant_id, user.nombre, user.email, user.password_hash, user.rol]);
    sqliteClient.execute(
      `INSERT INTO productos (id, tenant_id, sku, nombre, stock_actual, precio_compra, precio_venta)
       VALUES (?, ?, ?, 'Crema de leche', 20.0, 500, 1000)`,
      [idLocal, ids.tenantId, sku]
    );
    const saleId = createFixtureIds().ventaId;
    sqliteClient.execute(
      `INSERT INTO transacciones_venta (id, tenant_id, usuario_id, folio_local_sqlite, total, unidades, estado, is_dirty, sync_status)
       VALUES (?, ?, ?, 'FOLIO-MISMO-SKU', 2000.0, 2.0, 'COMPLETADA', 1, 'PENDING')`,
      [saleId, ids.tenantId, ids.usuarioCajeroId]
    );
    sqliteClient.execute(
      `INSERT INTO detalle_venta (id, venta_id, producto_id, cantidad, precio_unitario, subtotal)
       VALUES (?, ?, ?, 2.0, 1000.0, 2000.0)`,
      [createFixtureIds().detalleVentaId, saleId, idLocal]
    );

    const pushResult = await posEngine.syncPush(ids.tenantId, (payload) => cloudReceiver.ingestPushBatch(payload));

    expect(pushResult.success).toBe(true);
    expect(pushResult.synced_ids).toContain(saleId);
    const detalle = await pgClient.query<{ producto_id: string }>('SELECT producto_id FROM detalle_venta WHERE venta_id = $1', [saleId]);
    expect(detalle.rows[0].producto_id).toBe(idNube);
    const stock = await pgClient.query<{ stock_actual: string }>('SELECT stock_actual FROM productos WHERE id = $1', [idNube]);
    expect(Number(stock.rows[0].stock_actual)).toBe(18.0);
    const duplicados = await pgClient.query('SELECT id FROM productos WHERE tenant_id = $1 AND sku = $2', [ids.tenantId, sku]);
    expect(duplicados.rows.length).toBe(1);
  });

  test('4. La bajada reconoce por SKU el producto que el terminal tiene con otro id, sin deshacer el resto', async () => {
    const ids = createFixtureIds();
    const tenant = sampleTenant(ids.tenantId);
    const idLocal = ids.productoId;
    const idNube = createFixtureIds().productoId;
    const idNuevo = createFixtureIds().productoId;
    const sku = `SKU-DEMO-${idLocal.slice(0, 8)}`;

    sqliteClient.execute('INSERT INTO tenants (id, nombre, estado) VALUES (?, ?, ?)', [tenant.id, tenant.nombre, tenant.estado]);
    sqliteClient.execute(
      `INSERT INTO productos (id, tenant_id, sku, nombre, stock_actual, precio_compra, precio_venta)
       VALUES (?, ?, ?, 'Crema de leche', 10.0, 500, 1000)`,
      [idLocal, ids.tenantId, sku]
    );
    await pgClient.query(`INSERT INTO tenants (id, nombre, estado) VALUES ($1, $2, $3)`, [tenant.id, tenant.nombre, tenant.estado]);
    await pgClient.query(
      `INSERT INTO productos (id, tenant_id, sku, nombre, stock_actual, precio_compra, precio_venta)
       VALUES ($1, $2, $3, 'Crema de leche 200 cc', 10.0, 550, 1190),
              ($4, $2, $5, 'Producto nuevo de la nube', 5.0, 300, 700)`,
      [idNube, ids.tenantId, sku, idNuevo, `SKU-NUEVO-${idNuevo.slice(0, 8)}`]
    );

    const updatedCount = await posEngine.syncPullCatalog(ids.tenantId, (req) =>
      cloudReceiver.getPullUpdates(req.tenant_id, req.last_pull_timestamp)
    );

    expect(updatedCount).toBe(2);
    const locales = sqliteClient.query<Producto>('SELECT id, nombre, precio_venta FROM productos WHERE tenant_id = ? ORDER BY nombre', [ids.tenantId]);
    expect(locales.map((p) => p.id)).toEqual([idLocal, idNuevo]);
    expect(locales[0].nombre).toBe('Crema de leche 200 cc');
    expect(Number(locales[0].precio_venta)).toBe(1190);
  });

  test('5. Reintentar una venta detenida la devuelve a la cola con los intentos en cero', () => {
    const ids = createFixtureIds();
    const tenant = sampleTenant(ids.tenantId);
    const user = sampleUsuario(ids.usuarioCajeroId, ids.tenantId, 'cajero');
    sqliteClient.execute('INSERT INTO tenants (id, nombre, estado) VALUES (?, ?, ?)', [tenant.id, tenant.nombre, tenant.estado]);
    sqliteClient.execute('INSERT INTO usuarios (id, tenant_id, nombre, email, password_hash, rol) VALUES (?, ?, ?, ?, ?, ?)', [user.id, user.tenant_id, user.nombre, user.email, user.password_hash, user.rol]);
    sqliteClient.execute(
      `INSERT INTO transacciones_venta (id, tenant_id, usuario_id, folio_local_sqlite, total, unidades, estado, is_dirty, sync_status, sync_attempts)
       VALUES (?, ?, ?, 'FOLIO-DETENIDA', 1000.0, 1.0, 'COMPLETADA', 0, 'FAILED', 5)`,
      [ids.ventaId, ids.tenantId, ids.usuarioCajeroId]
    );
    expect(posEngine.contarVentasDetenidas(ids.tenantId)).toBe(1);

    expect(posEngine.reintentarVenta(ids.tenantId, ids.ventaId)).toBe(true);
    expect(posEngine.contarVentasDetenidas(ids.tenantId)).toBe(0);
    expect(posEngine.getPendingDirtySales(ids.tenantId).map((i) => i.sale.id)).toContain(ids.ventaId);
    expect(posEngine.reintentarVenta(ids.tenantId, 'no-existe')).toBe(false);
  });

  test('6. La bajada trae el proveedor del producto nuevo y lo reconoce por RUT si el terminal lo tiene con otro id', async () => {
    const ids = createFixtureIds();
    const tenant = sampleTenant(ids.tenantId);
    const provLocal = createFixtureIds().productoId;
    const provNube = createFixtureIds().productoId;
    const provSoloNube = createFixtureIds().productoId;
    const rut = `78.${ids.tenantId.slice(0, 3)}.685-1`;
    const rutNuevo = `79.${ids.tenantId.slice(0, 3)}.111-2`;
    const prodA = createFixtureIds().productoId;
    const prodB = createFixtureIds().productoId;

    sqliteClient.execute('INSERT INTO tenants (id, nombre, estado) VALUES (?, ?, ?)', [tenant.id, tenant.nombre, tenant.estado]);
    sqliteClient.execute(
      'INSERT INTO proveedores (id, tenant_id, rut_proveedor, nombre_proveedores) VALUES (?, ?, ?, ?)',
      [provLocal, ids.tenantId, rut, 'Froneri Chile SpA']
    );
    await pgClient.query(`INSERT INTO tenants (id, nombre, estado) VALUES ($1, $2, $3)`, [tenant.id, tenant.nombre, tenant.estado]);
    await pgClient.query(
      `INSERT INTO proveedores (id, tenant_id, rut_proveedor, nombre_proveedores)
       VALUES ($1, $2, $3, 'Froneri Chile SpA'), ($4, $2, $5, 'Proveedor solo en la nube')`,
      [provNube, ids.tenantId, rut, provSoloNube, rutNuevo]
    );
    await pgClient.query(
      `INSERT INTO productos (id, tenant_id, proveedor_id, sku, nombre, stock_actual, precio_compra, precio_venta)
       VALUES ($1, $2, $3, $4, 'Helado nuevo', 5.0, 900, 1500),
              ($5, $2, $6, $7, 'Producto de proveedor nuevo', 5.0, 300, 600)`,
      [prodA, ids.tenantId, provNube, `SKU-FRO-${prodA.slice(0, 8)}`, prodB, provSoloNube, `SKU-NVO-${prodB.slice(0, 8)}`]
    );

    const updatedCount = await posEngine.syncPullCatalog(ids.tenantId, (req) =>
      cloudReceiver.getPullUpdates(req.tenant_id, req.last_pull_timestamp)
    );

    expect(updatedCount).toBe(2);
    const a = sqliteClient.queryOne<{ proveedor_id: string }>('SELECT proveedor_id FROM productos WHERE id = ?', [prodA]);
    const b = sqliteClient.queryOne<{ proveedor_id: string }>('SELECT proveedor_id FROM productos WHERE id = ?', [prodB]);
    expect(a?.proveedor_id).toBe(provLocal);
    expect(b?.proveedor_id).toBe(provSoloNube);
    const froneri = sqliteClient.query('SELECT id FROM proveedores WHERE tenant_id = ? AND rut_proveedor = ?', [ids.tenantId, rut]);
    expect(froneri.length).toBe(1);
  });

  test('7. El respaldo del catalogo sube desactivado el producto que el terminal desactivo', async () => {
    const ids = createFixtureIds();
    const tenant = sampleTenant(ids.tenantId);
    sqliteClient.execute('INSERT INTO tenants (id, nombre, estado) VALUES (?, ?, ?)', [tenant.id, tenant.nombre, tenant.estado]);
    await pgClient.query(`INSERT INTO tenants (id, nombre, estado) VALUES ($1, $2, $3)`, [tenant.id, tenant.nombre, tenant.estado]);
    sqliteClient.execute(
      `INSERT INTO productos (id, tenant_id, sku, nombre, stock_actual, precio_compra, precio_venta, activo)
       VALUES (?, ?, ?, 'BORRAR - prueba automatica', 5.0, 500, 1000, 0)`,
      [ids.productoId, ids.tenantId, `PRUEBA-${ids.productoId.slice(0, 8)}`]
    );

    await posEngine.respaldarCatalogoEnNube(ids.tenantId, (t, productos, proveedores) =>
      cloudReceiver.respaldarCatalogo(t, productos, proveedores)
    );

    const arriba = await pgClient.query<{ activo: boolean }>('SELECT activo FROM productos WHERE id = $1', [ids.productoId]);
    expect(arriba.rows[0].activo).toBe(false);
  });
});

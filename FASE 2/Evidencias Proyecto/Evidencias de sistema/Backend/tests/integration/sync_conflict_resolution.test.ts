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
});

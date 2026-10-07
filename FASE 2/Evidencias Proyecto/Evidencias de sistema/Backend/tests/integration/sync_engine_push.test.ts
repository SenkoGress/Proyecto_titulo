import { PostgresClient } from '../../src/database/postgres/client';
import { SqliteClient } from '../../src/database/sqlite/client';
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

describe('Offline-First Push Sync & Idempotency', () => {
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

  test('1. Debe sincronizar exitosamente un lote de ventas offline desde SQLite a PostgreSQL', async () => {
    const ids = createFixtureIds();
    const tenant = sampleTenant(ids.tenantId);
    const user = sampleUsuario(ids.usuarioCajeroId, ids.tenantId, 'cajero');
    const prod1 = sampleProducto(ids.productoId, ids.tenantId);
    const prod2 = sampleProducto(createFixtureIds().productoId, ids.tenantId);
    const metodo = sampleMetodoPago(ids.metodoPagoId);

    // 1. Inicializar datos base en PostgreSQL
    await pgClient.query(`INSERT INTO tenants (id, nombre, estado) VALUES ($1, $2, $3)`, [tenant.id, tenant.nombre, tenant.estado]);
    await pgClient.query(`INSERT INTO usuarios (id, tenant_id, nombre, email, password_hash, rol) VALUES ($1, $2, $3, $4, $5, $6)`, [user.id, user.tenant_id, user.nombre, user.email, user.password_hash, user.rol]);
    await pgClient.query(`INSERT INTO metodos_pago (id, nombre, descripcion, activo, pasarela) VALUES ($1, $2, $3, $4, $5)`, [metodo.id, metodo.nombre, metodo.descripcion, metodo.activo, metodo.pasarela]);
    await pgClient.query(`INSERT INTO productos (id, tenant_id, sku, nombre, stock_actual, precio_compra, precio_venta) VALUES ($1, $2, $3, $4, $5, $6, $7)`, [prod1.id, prod1.tenant_id, prod1.sku, prod1.nombre, 50.0, 500, 1000]);
    await pgClient.query(`INSERT INTO productos (id, tenant_id, sku, nombre, stock_actual, precio_compra, precio_venta) VALUES ($1, $2, $3, $4, $5, $6, $7)`, [prod2.id, prod2.tenant_id, prod2.sku, prod2.nombre, 30.0, 800, 1500]);

    // 2. Inicializar espejo local en SQLite
    sqliteClient.execute('INSERT INTO tenants (id, nombre, estado) VALUES (?, ?, ?)', [tenant.id, tenant.nombre, tenant.estado]);
    sqliteClient.execute('INSERT INTO usuarios (id, tenant_id, nombre, email, password_hash, rol) VALUES (?, ?, ?, ?, ?, ?)', [user.id, user.tenant_id, user.nombre, user.email, user.password_hash, user.rol]);
    sqliteClient.execute('INSERT INTO metodos_pago (id, nombre, descripcion, activo, pasarela) VALUES (?, ?, ?, ?, ?)', [metodo.id, metodo.nombre, metodo.descripcion, 1, metodo.pasarela]);
    sqliteClient.execute('INSERT INTO productos (id, tenant_id, sku, nombre, stock_actual, precio_compra, precio_venta) VALUES (?, ?, ?, ?, ?, ?, ?)', [prod1.id, prod1.tenant_id, prod1.sku, prod1.nombre, 50.0, 500, 1000]);
    sqliteClient.execute('INSERT INTO productos (id, tenant_id, sku, nombre, stock_actual, precio_compra, precio_venta) VALUES (?, ?, ?, ?, ?, ?, ?)', [prod2.id, prod2.tenant_id, prod2.sku, prod2.nombre, 30.0, 800, 1500]);

    // 3. Crear 2 ventas offline en SQLite con is_dirty = 1
    const saleId1 = createFixtureIds().ventaId;
    const saleId2 = createFixtureIds().ventaId;

    // Venta 1: 2 unidades de prod1
    sqliteClient.execute(
      `INSERT INTO transacciones_venta (id, tenant_id, usuario_id, folio_local_sqlite, total, unidades, estado, metodo_pago_id, is_dirty, sync_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 'PENDING')`,
      [saleId1, ids.tenantId, ids.usuarioCajeroId, 'FOLIO-OFFLINE-001', 2000.0, 2.0, 'COMPLETADA', ids.metodoPagoId]
    );
    sqliteClient.execute(
      `INSERT INTO detalle_venta (id, venta_id, producto_id, cantidad, precio_unitario, subtotal)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [createFixtureIds().detalleVentaId, saleId1, prod1.id, 2.0, 1000.0, 2000.0]
    );

    // Venta 2: 1 unidad de prod2
    sqliteClient.execute(
      `INSERT INTO transacciones_venta (id, tenant_id, usuario_id, folio_local_sqlite, total, unidades, estado, metodo_pago_id, is_dirty, sync_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 'PENDING')`,
      [saleId2, ids.tenantId, ids.usuarioCajeroId, 'FOLIO-OFFLINE-002', 1500.0, 1.0, 'COMPLETADA', ids.metodoPagoId]
    );
    sqliteClient.execute(
      `INSERT INTO detalle_venta (id, venta_id, producto_id, cantidad, precio_unitario, subtotal)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [createFixtureIds().detalleVentaId, saleId2, prod2.id, 1.0, 1500.0, 1500.0]
    );

    // Verificar que están pendientes en SQLite
    const dirtyBefore = posEngine.getPendingDirtySales(ids.tenantId);
    expect(dirtyBefore.length).toBe(2);

    // 4. Ejecutar sincronización Push hacia la Nube
    const pushResult = await posEngine.syncPush(ids.tenantId, async (payload) => {
      return cloudReceiver.ingestPushBatch(payload);
    });

    expect(pushResult.success).toBe(true);
    expect(pushResult.synced_ids).toContain(saleId1);
    expect(pushResult.synced_ids).toContain(saleId2);

    // 5. Verificar que en SQLite se limpió el estado dirty
    const dirtyAfter = posEngine.getPendingDirtySales(ids.tenantId);
    expect(dirtyAfter.length).toBe(0);

    const localSale1 = sqliteClient.queryOne<{ is_dirty: number; sync_status: string }>(
      'SELECT is_dirty, sync_status FROM transacciones_venta WHERE id = ?',
      [saleId1]
    );
    expect(localSale1?.is_dirty).toBe(0);
    expect(localSale1?.sync_status).toBe('SYNCED');

    // 6. Verificar que en PostgreSQL existen las ventas y el stock se descontó correctamente
    const cloudSale1 = await pgClient.query('SELECT total FROM transacciones_venta WHERE id = $1', [saleId1]);
    expect(cloudSale1.rows.length).toBe(1);
    expect(Number(cloudSale1.rows[0].total)).toBe(2000.0);

    const cloudProd1 = await pgClient.query<{ stock_actual: string }>('SELECT stock_actual FROM productos WHERE id = $1', [prod1.id]);
    expect(Number(cloudProd1.rows[0].stock_actual)).toBe(48.0); // 50 - 2

    const cloudProd2 = await pgClient.query<{ stock_actual: string }>('SELECT stock_actual FROM productos WHERE id = $1', [prod2.id]);
    expect(Number(cloudProd2.rows[0].stock_actual)).toBe(29.0); // 30 - 1
  });

  test('2. Idempotencia: Re-enviar el mismo lote no duplica registros ni vuelve a descontar stock', async () => {
    const ids = createFixtureIds();
    const tenant = sampleTenant(ids.tenantId);
    const user = sampleUsuario(ids.usuarioCajeroId, ids.tenantId, 'cajero');
    const prod = sampleProducto(ids.productoId, ids.tenantId);

    await pgClient.query(`INSERT INTO tenants (id, nombre, estado) VALUES ($1, $2, $3)`, [tenant.id, tenant.nombre, tenant.estado]);
    await pgClient.query(`INSERT INTO usuarios (id, tenant_id, nombre, email, password_hash, rol) VALUES ($1, $2, $3, $4, $5, $6)`, [user.id, user.tenant_id, user.nombre, user.email, user.password_hash, user.rol]);
    await pgClient.query(`INSERT INTO productos (id, tenant_id, sku, nombre, stock_actual, precio_compra, precio_venta) VALUES ($1, $2, $3, $4, $5, $6, $7)`, [prod.id, prod.tenant_id, prod.sku, prod.nombre, 100.0, 500, 1000]);

    const saleId = createFixtureIds().ventaId;
    const payload = {
      tenant_id: ids.tenantId,
      device_id: 'DEVICE-IDEMPOTENT',
      sales: [
        {
          sale: {
            id: saleId,
            tenant_id: ids.tenantId,
            usuario_id: user.id,
            folio_local_sqlite: 'FOLIO-IDEMPOTENT-01',
            total: 1000.0,
            unidades: 1.0,
            estado: 'COMPLETADA'
          },
          details: [
            {
              id: createFixtureIds().detalleVentaId,
              venta_id: saleId,
              producto_id: prod.id,
              cantidad: 1.0,
              precio_unitario: 1000.0,
              subtotal: 1000.0
            }
          ]
        }
      ]
    };

    // Primer envío: Debe registrar la venta y dejar el stock en 99
    const firstAttempt = await cloudReceiver.ingestPushBatch(payload);
    expect(firstAttempt.success).toBe(true);
    expect(firstAttempt.synced_ids).toContain(saleId);

    const stockFirst = await pgClient.query<{ stock_actual: string }>('SELECT stock_actual FROM productos WHERE id = $1', [prod.id]);
    expect(Number(stockFirst.rows[0].stock_actual)).toBe(99.0);

    // Segundo envío idéntico: Debe retornar éxito idempotente y NO descontar el stock otra vez
    const secondAttempt = await cloudReceiver.ingestPushBatch(payload);
    expect(secondAttempt.success).toBe(true);
    expect(secondAttempt.synced_ids).toContain(saleId);

    const stockSecond = await pgClient.query<{ stock_actual: string }>('SELECT stock_actual FROM productos WHERE id = $1', [prod.id]);
    expect(Number(stockSecond.rows[0].stock_actual)).toBe(99.0); // El stock se mantiene exactamente en 99
  });
});

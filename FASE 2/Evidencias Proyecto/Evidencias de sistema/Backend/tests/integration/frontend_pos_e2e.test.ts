import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import app from '../../src/index';
import { defaultPgClient } from '../../src/database/postgres/client';
import { defaultSqliteClient } from '../../src/database/sqlite/client';
import { SqliteMigrator } from '../../src/database/sqlite/migrator';
import { defaultPosSyncEngine } from '../../src/sync/pos-sync-engine.service';
import { createTestPostgresClient } from '../helpers/db-test-helper';

describe('Frontend POS E2E Lifecycle & Offline-First Checkout', () => {
  const tenantId = uuidv4();
  const userId = uuidv4();
  const productId = uuidv4();
  const sku = 'POS-E2E-PROD-01';

  beforeAll(async () => {
    const { client: testPg } = await createTestPostgresClient();
    defaultPgClient.setPool(testPg.getPool());

    // 0. Ejecutar migraciones SQLite para el cliente por defecto
    const sqliteMigrator = new SqliteMigrator(
      defaultSqliteClient,
      path.resolve(__dirname, '../../src/database/sqlite/migrations')
    );
    sqliteMigrator.migrate();

    // 1. Sembrar Tenant y Usuario en PostgreSQL
    await defaultPgClient.query(
      "INSERT INTO tenants (id, nombre, estado) VALUES ($1, 'Tenant POS E2E', 'ACTIVO') ON CONFLICT DO NOTHING",
      [tenantId]
    );
    await defaultPgClient.query(
      `INSERT INTO usuarios (id, tenant_id, nombre, email, password_hash, rol)
       VALUES ($1, $2, 'Cajero E2E', $3, 'hash123', 'cajero') ON CONFLICT DO NOTHING`,
      [userId, tenantId, `cajero-${tenantId.slice(0, 8)}@gestock.cl`]
    );

    // 2. Sembrar en SQLite local
    defaultSqliteClient.execute(
      "INSERT INTO tenants (id, nombre, estado) VALUES (?, 'Tenant POS E2E', 'ACTIVO')",
      [tenantId]
    );
    defaultSqliteClient.execute(
      `INSERT INTO usuarios (id, tenant_id, nombre, email, password_hash, rol)
       VALUES (?, ?, 'Cajero E2E', ?, 'hash123', 'cajero')`,
      [userId, tenantId, `cajero-${tenantId.slice(0, 8)}@gestock.cl`]
    );

    // 3. Sembrar Producto con 50 unidades de stock
    defaultSqliteClient.execute(
      `INSERT INTO productos 
       (id, tenant_id, sku, nombre, stock_actual, stock_minimo, precio_venta, precio_compra, categoria, activo)
       VALUES (?, ?, ?, 'Bebida Energética 500ml', 50.00, 10.00, 2500.00, 1200.00, 'Bebidas', 1)`,
      [productId, tenantId, sku]
    );

    // Sembrar también en PostgreSQL para cuando se sincronice
    await defaultPgClient.query(
      `INSERT INTO productos 
       (id, tenant_id, sku, nombre, stock_actual, stock_minimo, precio_venta, precio_compra, categoria, activo)
       VALUES ($1, $2, $3, 'Bebida Energética 500ml', 50.00, 10.00, 2500.00, 1200.00, 'Bebidas', true)`,
      [productId, tenantId, sku]
    );
  });

  afterAll(async () => {
    try {
      await defaultPgClient.query('DELETE FROM detalle_venta WHERE venta_id IN (SELECT id FROM transacciones_venta WHERE tenant_id = $1)', [tenantId]);
      await defaultPgClient.query('DELETE FROM transacciones_venta WHERE tenant_id = $1', [tenantId]);
      await defaultPgClient.query('DELETE FROM tenants WHERE id = $1', [tenantId]);
    } catch {
      // Ignorar si ya fue eliminado
    }
  });

  test('1. Consulta de Catálogo Local en SQLite: Respuesta instantánea (<50ms)', async () => {
    const start = Date.now();
    const rows = defaultSqliteClient.query<any>(
      'SELECT id, sku, nombre, stock_actual, precio_venta FROM productos WHERE tenant_id = ? AND activo = 1',
      [tenantId]
    );
    const duration = Date.now() - start;

    expect(rows.length).toBeGreaterThanOrEqual(1);
    const prod = rows.find(r => r.sku === sku);
    expect(prod).toBeDefined();
    expect(Number(prod.stock_actual)).toBe(50);
    expect(Number(prod.precio_venta)).toBe(2500);
    expect(duration).toBeLessThan(50);
  });

  test('2. Checkout Rápido Atómico: Descuenta stock, genera bandera is_dirty y audita movimiento en <200ms', async () => {
    const start = Date.now();
    const saleId = uuidv4();
    const folio = `POS-TEST-${Date.now()}`;
    const cantidad = 3;
    const precio = 2500;
    const total = cantidad * precio;

    // Ejecutar checkout transaccional
    defaultSqliteClient.withTransaction(() => {
      // Registrar venta con is_dirty = 1
      defaultSqliteClient.execute(
        `INSERT INTO transacciones_venta 
         (id, tenant_id, usuario_id, folio_local_sqlite, total, unidades, estado, is_dirty, sync_attempts, sync_status, fecha)
         VALUES (?, ?, ?, ?, ?, ?, 'COMPLETADA', 1, 0, 'PENDING', datetime('now'))`,
        [saleId, tenantId, userId, folio, total, cantidad]
      );

      // Registrar detalle
      defaultSqliteClient.execute(
        `INSERT INTO detalle_venta 
         (id, venta_id, producto_id, cantidad, precio_unitario, subtotal)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [uuidv4(), saleId, productId, cantidad, precio, total]
      );

      // Descontar stock
      defaultSqliteClient.execute(
        'UPDATE productos SET stock_actual = stock_actual - ? WHERE id = ?',
        [cantidad, productId]
      );

      // Registrar historial de stock
      defaultSqliteClient.execute(
        `INSERT INTO historial_stock 
         (id, tenant_id, producto_id, cambio_anterior, nuevo_stock, cambio, tipo_movimiento, id_venta_manual, motivo, fecha_movimiento, usuario_registro)
         VALUES (?, ?, ?, 50.00, 47.00, -3.00, 'venta', ?, 'Venta POS Test', datetime('now'), ?)`,
        [uuidv4(), tenantId, productId, saleId, userId]
      );
    });

    const duration = Date.now() - start;

    // Verificaciones
    const updatedProd = defaultSqliteClient.queryOne<any>(
      'SELECT stock_actual FROM productos WHERE id = ?',
      [productId]
    );
    expect(Number(updatedProd?.stock_actual)).toBe(47);

    const sale = defaultSqliteClient.queryOne<any>(
      'SELECT is_dirty, sync_status, total FROM transacciones_venta WHERE id = ?',
      [saleId]
    );
    expect(sale?.is_dirty).toBe(1);
    expect(sale?.sync_status).toBe('PENDING');
    expect(Number(sale?.total)).toBe(7500);

    expect(duration).toBeLessThan(200);
  });

  test('3. Sincronización Push a la Nube: Sube venta pendiente y limpia bandera is_dirty a 0', async () => {
    // Ejecutar sincronización push
    const syncRes = await defaultPosSyncEngine.syncPush(tenantId);
    expect(syncRes.success).toBe(true);
    expect(syncRes.synced_ids.length).toBeGreaterThanOrEqual(1);

    // Verificar que en SQLite local la venta ya no es dirty
    const dirtySales = defaultSqliteClient.query<any>(
      'SELECT id FROM transacciones_venta WHERE tenant_id = ? AND is_dirty = 1',
      [tenantId]
    );
    expect(dirtySales.length).toBe(0);

    // Verificar que en PostgreSQL Cloud SaaS la venta existe con estado SYNCED
    const pgSales = await defaultPgClient.query<any>(
      'SELECT id, sync_status, total FROM transacciones_venta WHERE tenant_id = $1',
      [tenantId]
    );
    expect(pgSales.rows.length).toBeGreaterThanOrEqual(1);
    expect(pgSales.rows[0].sync_status).toBe('SYNCED');
  });

  test('4. Semáforo y Estado del Nodo POS: Reporta 0 ventas sucias tras sincronización exitosa', () => {
    const dirtyCountResult = defaultSqliteClient.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM transacciones_venta WHERE tenant_id = ? AND is_dirty = 1',
      [tenantId]
    );
    expect(dirtyCountResult?.count).toBe(0);
  });
});

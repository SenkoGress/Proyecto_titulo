import { SqliteClient } from '../../src/database/sqlite/client';
import { createTestSqliteClient } from '../helpers/db-test-helper';
import {
  createFixtureIds,
  samplePlan,
  sampleTenant,
  sampleUsuario,
  sampleProveedor,
  sampleProducto,
  sampleMetodoPago
} from '../helpers/fixtures';

describe('SQLite Local Mirror Schema & Offline-First Protocol', () => {
  let client: SqliteClient;

  beforeAll(() => {
    const setup = createTestSqliteClient();
    client = setup.client;
  });

  afterAll(() => {
    client.close();
  });

  test('1. Debe existir el espejo de las 15+ tablas en SQLite local', () => {
    const expectedTables = [
      'planes_facturacion',
      'tenants',
      'usuarios',
      'notificaciones_tokens',
      'historial_planes',
      'configuracion_sistema',
      'proveedores',
      'catalogo_borradores',
      'productos',
      'movimientos_inventario_tipos',
      'movimientos_inventario',
      'historial_stock',
      'factura_ingresos',
      'metodos_pago',
      'transacciones_venta',
      'detalle_venta'
    ];

    const tables = client.query<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`
    );

    const tableNames = tables.map((t) => t.name.toLowerCase());
    for (const table of expectedTables) {
      expect(tableNames).toContain(table);
    }
  });

  test('2. Debe registrar transacciones de venta con banderas Offline-First (is_dirty, sync_attempts)', () => {
    const ids = createFixtureIds();

    // 1. Tenant y Usuario
    const tenant = sampleTenant(ids.tenantId);
    client.execute(
      'INSERT INTO tenants (id, nombre, estado) VALUES (?, ?, ?)',
      [tenant.id, tenant.nombre, tenant.estado]
    );

    const user = sampleUsuario(ids.usuarioCajeroId, ids.tenantId, 'cajero');
    client.execute(
      'INSERT INTO usuarios (id, tenant_id, nombre, email, password_hash, rol) VALUES (?, ?, ?, ?, ?, ?)',
      [user.id, user.tenant_id, user.nombre, user.email, user.password_hash, user.rol]
    );

    // 2. Metodo de pago
    const metodo = sampleMetodoPago(ids.metodoPagoId);
    client.execute(
      'INSERT INTO metodos_pago (id, nombre, descripcion, activo, pasarela) VALUES (?, ?, ?, ?, ?)',
      [metodo.id, metodo.nombre, metodo.descripcion, 1, metodo.pasarela]
    );

    // 3. Producto
    const prod = sampleProducto(ids.productoId, ids.tenantId);
    client.execute(
      'INSERT INTO productos (id, tenant_id, sku, nombre, precio_compra, precio_venta, stock_actual) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [prod.id, prod.tenant_id, prod.sku, prod.nombre, prod.precio_compra, prod.precio_venta, 50.0]
    );

    // 4. Venta Local sin conexión (Offline)
    const folioLocal = 'FOLIO-LOCAL-10023';
    client.execute(
      `INSERT INTO transacciones_venta 
       (id, tenant_id, usuario_id, folio_local_sqlite, total, unidades, estado, metodo_pago_id, is_dirty, sync_attempts, sync_status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [ids.ventaId, ids.tenantId, ids.usuarioCajeroId, folioLocal, 3000.0, 2.0, 'COMPLETADA', ids.metodoPagoId, 1, 0, 'PENDING']
    );

    // 5. Detalle
    client.execute(
      'INSERT INTO detalle_venta (id, venta_id, producto_id, cantidad, precio_unitario, subtotal) VALUES (?, ?, ?, ?, ?, ?)',
      [ids.detalleVentaId, ids.ventaId, ids.productoId, 2.0, 1500.0, 3000.0]
    );

    // Verificación de flags Offline-First
    const pendingSales = client.query<{
      id: string;
      folio_local_sqlite: string;
      is_dirty: number;
      sync_status: string;
    }>('SELECT * FROM transacciones_venta WHERE is_dirty = 1 AND sync_status = ?', ['PENDING']);

    expect(pendingSales.length).toBeGreaterThan(0);
    const sale = pendingSales.find((s) => s.id === ids.ventaId);
    expect(sale).toBeDefined();
    expect(sale?.folio_local_sqlite).toBe(folioLocal);
    expect(sale?.is_dirty).toBe(1);
    expect(sale?.sync_status).toBe('PENDING');
  });

  test('3. Debe forzar integridad referencial en SQLite mediante PRAGMA foreign_keys = ON', () => {
    const invalidTenantId = 'invalido-000-000';
    const fakeUserId = 'user-000-000';

    // Intento de insertar usuario huérfano
    expect(() => {
      client.execute(
        'INSERT INTO usuarios (id, tenant_id, nombre, email, password_hash, rol) VALUES (?, ?, ?, ?, ?, ?)',
        [fakeUserId, invalidTenantId, 'NoExiste', 'no@test.cl', 'pass', 'cajero']
      );
    }).toThrow(/FOREIGN KEY constraint failed/i);
  });

  test('4. Debe soportar simulación de sincronización exitosa (limpieza de is_dirty)', () => {
    const ids = createFixtureIds();
    const tenant = sampleTenant(ids.tenantId);

    // Actualizar estado tras sincronización con la nube
    const updateResult = client.execute(
      `UPDATE transacciones_venta 
       SET is_dirty = 0, sync_status = 'SYNCED', last_synced_at = datetime('now')
       WHERE is_dirty = 1`
    );

    expect(updateResult.changes).toBeGreaterThanOrEqual(1);

    const remainingDirty = client.query('SELECT id FROM transacciones_venta WHERE is_dirty = 1');
    expect(remainingDirty.length).toBe(0);
  });
});

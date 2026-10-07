import { PostgresClient } from '../../src/database/postgres/client';
import { ReplenishmentService } from '../../src/replenishment/replenishment.service';
import { createTestPostgresClient } from '../helpers/db-test-helper';
import {
  createFixtureIds,
  sampleMetodoPago,
  sampleProducto,
  sampleProveedor,
  sampleTenant,
  sampleUsuario
} from '../helpers/fixtures';

describe('Predictive Replenishment & Suggested Purchase Orders Engine', () => {
  let pgClient: PostgresClient;
  let replenishmentService: ReplenishmentService;

  beforeAll(async () => {
    const pgSetup = await createTestPostgresClient();
    pgClient = pgSetup.client;
    replenishmentService = new ReplenishmentService(pgClient);
  });

  afterAll(async () => {
    await pgClient.close();
  });

  test('1. Debe calcular correctamente la velocidad de rotación de ventas y punto de reorden (ROP)', async () => {
    const ids = createFixtureIds();
    const tenant = sampleTenant(ids.tenantId);
    const user = sampleUsuario(ids.usuarioAdminId, ids.tenantId);
    const prov = sampleProveedor(ids.proveedorId, ids.tenantId);
    const metodo = sampleMetodoPago(ids.metodoPagoId);

    // Producto A: Alta rotación, stock actual bajo (en riesgo de quiebre)
    const prodA = sampleProducto(ids.productoId, ids.tenantId, prov.id);
    prodA.stock_actual = 15.0;
    prodA.stock_minimo = 5.0;

    // Producto B: Baja rotación, stock actual alto (holgado)
    const prodB = sampleProducto(createFixtureIds().productoId, ids.tenantId, prov.id);
    prodB.stock_actual = 80.0;
    prodB.stock_minimo = 5.0;

    // Persistir entidades base
    await pgClient.query(`INSERT INTO tenants (id, nombre, estado) VALUES ($1, $2, $3)`, [tenant.id, tenant.nombre, tenant.estado]);
    await pgClient.query(`INSERT INTO usuarios (id, tenant_id, nombre, email, password_hash, rol) VALUES ($1, $2, $3, $4, $5, $6)`, [user.id, user.tenant_id, user.nombre, user.email, user.password_hash, user.rol]);
    await pgClient.query(`INSERT INTO proveedores (id, tenant_id, rut_proveedor, nombre_proveedores) VALUES ($1, $2, $3, $4)`, [prov.id, prov.tenant_id, prov.rut_proveedor, prov.nombre_proveedores]);
    await pgClient.query(`INSERT INTO metodos_pago (id, nombre, descripcion, activo, pasarela) VALUES ($1, $2, $3, $4, $5)`, [metodo.id, metodo.nombre, metodo.descripcion, metodo.activo, metodo.pasarela]);

    await pgClient.query(
      `INSERT INTO productos (id, tenant_id, proveedor_id, sku, nombre, stock_actual, stock_minimo, precio_compra, precio_venta)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [prodA.id, prodA.tenant_id, prodA.proveedor_id, prodA.sku, prodA.nombre, prodA.stock_actual, prodA.stock_minimo, 500, 1000]
    );

    await pgClient.query(
      `INSERT INTO productos (id, tenant_id, proveedor_id, sku, nombre, stock_actual, stock_minimo, precio_compra, precio_venta)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [prodB.id, prodB.tenant_id, prodB.proveedor_id, prodB.sku, prodB.nombre, prodB.stock_actual, prodB.stock_minimo, 300, 700]
    );

    // Simular historial de ventas en los últimos 7 días:
    // Producto A: 70 unidades vendidas en 7 días -> velocidad = 10 unidades/día
    const saleIdA = createFixtureIds().ventaId;
    await pgClient.query(
      `INSERT INTO transacciones_venta (id, tenant_id, usuario_id, folio_local_sqlite, fecha, total, unidades, estado, sync_status)
       VALUES ($1, $2, $3, 'FOLIO-VEL-A', now(), 70000, 70, 'COMPLETADA', 'SYNCED')`,
      [saleIdA, ids.tenantId, user.id]
    );
    await pgClient.query(
      `INSERT INTO detalle_venta (id, venta_id, producto_id, cantidad, precio_unitario, subtotal)
       VALUES ($1, $2, $3, 70.0, 1000.0, 70000.0)`,
      [createFixtureIds().detalleVentaId, saleIdA, prodA.id]
    );

    // Producto B: 7 unidades vendidas en 7 días -> velocidad = 1 unidad/día
    const saleIdB = createFixtureIds().ventaId;
    await pgClient.query(
      `INSERT INTO transacciones_venta (id, tenant_id, usuario_id, folio_local_sqlite, fecha, total, unidades, estado, sync_status)
       VALUES ($1, $2, $3, 'FOLIO-VEL-B', now(), 4900, 7, 'COMPLETADA', 'SYNCED')`,
      [saleIdB, ids.tenantId, user.id]
    );
    await pgClient.query(
      `INSERT INTO detalle_venta (id, venta_id, producto_id, cantidad, precio_unitario, subtotal)
       VALUES ($1, $2, $3, 7.0, 700.0, 4900.0)`,
      [createFixtureIds().detalleVentaId, saleIdB, prodB.id]
    );

    // Ejecutar cálculo de velocidad
    const velocities = await replenishmentService.calculateSalesVelocity(ids.tenantId, 7);

    const velA = velocities.find((v) => v.productId === prodA.id);
    const velB = velocities.find((v) => v.productId === prodB.id);

    expect(velA).toBeDefined();
    expect(velB).toBeDefined();

    // Verificaciones Producto A:
    // Velocidad diaria = 70 / 7 = 10
    expect(velA?.velocityDaily).toBe(10.0);
    // Días de inventario = 15 / 10 = 1.5 días
    expect(velA?.daysOfInventory).toBe(1.5);
    // ROP = (10 * 7 lead time) + 5 stock mínimo = 75
    expect(velA?.reorderPoint).toBe(75);
    // Stock actual (15) <= ROP (75) -> En riesgo de quiebre (isUnderStock = true)
    expect(velA?.isUnderStock).toBe(true);

    // Verificaciones Producto B:
    // Velocidad diaria = 7 / 7 = 1
    expect(velB?.velocityDaily).toBe(1.0);
    // Días de inventario = 80 / 1 = 80 días
    expect(velB?.daysOfInventory).toBe(80.0);
    // ROP = (1 * 7) + 5 = 12
    expect(velB?.reorderPoint).toBe(12);
    // Stock actual (80) > ROP (12) -> No requiere compra
    expect(velB?.isUnderStock).toBe(false);
  });

  test('2. Generación automática de órdenes de compra sugeridas agrupadas por proveedor en <200ms', async () => {
    const ids = createFixtureIds();
    const tenant = sampleTenant(ids.tenantId);
    const prov = sampleProveedor(ids.proveedorId, ids.tenantId);

    const prodA = sampleProducto(ids.productoId, ids.tenantId, prov.id);
    prodA.stock_actual = 10.0;
    prodA.stock_minimo = 5.0;

    await pgClient.query(`INSERT INTO tenants (id, nombre, estado) VALUES ($1, $2, $3)`, [tenant.id, tenant.nombre, tenant.estado]);
    await pgClient.query(`INSERT INTO proveedores (id, tenant_id, rut_proveedor, nombre_proveedores) VALUES ($1, $2, $3, $4)`, [prov.id, prov.tenant_id, prov.rut_proveedor, prov.nombre_proveedores]);

    await pgClient.query(
      `INSERT INTO productos (id, tenant_id, proveedor_id, sku, nombre, stock_actual, stock_minimo, precio_compra, precio_venta)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 500, 1000)`,
      [prodA.id, prodA.tenant_id, prodA.proveedor_id, prodA.sku, prodA.nombre, prodA.stock_actual, prodA.stock_minimo]
    );

    // Simular venta de 35 unidades en 7 días (velocidad 5/día)
    const saleId = createFixtureIds().ventaId;
    const user = sampleUsuario(createFixtureIds().usuarioAdminId, ids.tenantId);
    await pgClient.query(`INSERT INTO usuarios (id, tenant_id, nombre, email, password_hash, rol) VALUES ($1, $2, $3, $4, $5, $6)`, [user.id, user.tenant_id, user.nombre, user.email, user.password_hash, user.rol]);

    await pgClient.query(
      `INSERT INTO transacciones_venta (id, tenant_id, usuario_id, folio_local_sqlite, fecha, total, unidades, estado, sync_status)
       VALUES ($1, $2, $3, 'FOLIO-SUGGEST', now(), 35000, 35, 'COMPLETADA', 'SYNCED')`,
      [saleId, ids.tenantId, user.id]
    );
    await pgClient.query(
      `INSERT INTO detalle_venta (id, venta_id, producto_id, cantidad, precio_unitario, subtotal)
       VALUES ($1, $2, $3, 35.0, 1000.0, 35000.0)`,
      [createFixtureIds().detalleVentaId, saleId, prodA.id]
    );

    const startTime = Date.now();

    // Generar órdenes sugeridas
    const result = await replenishmentService.generateSuggestedOrders(ids.tenantId, {
      analysisDays: 7,
      defaultLeadTimeDays: 7,
      safetyStockFactor: 2.0 // Target = (5 * 7 * 2) + 5 = 75 unidades
    });

    const duration = Date.now() - startTime;

    // Validación de latencia < 200ms
    expect(duration).toBeLessThan(200);

    const orders = result.orders;
    expect(orders.length).toBe(1);
    const order = orders[0];

    expect(order.proveedorId).toBe(prov.id);
    expect(order.estado).toBe('sugerida');
    expect(order.items.length).toBe(1);

    // Cantidad sugerida = target (75) - stock actual (10) = 65 unidades
    expect(order.items[0].cantidadSugerida).toBe(65);
    // Total estimado = 65 * 500 = 32.500
    expect(order.totalEstimado).toBe(32500);

    // Verificar que la orden de compra y sus detalles se persistieron en PostgreSQL
    const savedOrder = await pgClient.query<{ id: string; estado: string; total_estimado: string }>(
      'SELECT id, estado, total_estimado FROM purchase_orders WHERE id = $1',
      [order.orderId]
    );
    expect(savedOrder.rows.length).toBe(1);
    expect(savedOrder.rows[0].estado).toBe('sugerida');
    expect(Number(savedOrder.rows[0].total_estimado)).toBe(32500);

    const savedDetails = await pgClient.query<{ cantidad_sugerida: string; product_id: string }>(
      'SELECT cantidad_sugerida, product_id FROM purchase_order_details WHERE purchase_order_id = $1',
      [order.orderId]
    );
    expect(savedDetails.rows.length).toBe(1);
    expect(Number(savedDetails.rows[0].cantidad_sugerida)).toBe(65);
  });
});

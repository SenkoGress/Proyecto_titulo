import { PostgresClient } from '../../src/database/postgres/client';
import { createTestPostgresClient } from '../helpers/db-test-helper';
import {
  createFixtureIds,
  samplePlan,
  sampleTenant,
  sampleUsuario,
  sampleProveedor,
  sampleProducto,
  sampleMetodoPago
} from '../helpers/fixtures';

describe('PostgreSQL Multi-Tenant Schema & Relational Integrity', () => {
  let client: PostgresClient;

  beforeAll(async () => {
    const setup = await createTestPostgresClient();
    client = setup.client;
  });

  afterAll(async () => {
    await client.close();
  });

  test('1. Debe haber creado exitosamente las 15+ tablas del modelo relacional unificado', async () => {
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

    const result = await client.query<{ table_name: string }>(
      `SELECT table_name 
       FROM information_schema.tables 
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
    );

    const createdTables = result.rows.map((r) => r.table_name.toLowerCase());
    for (const table of expectedTables) {
      expect(createdTables).toContain(table);
    }
  });

  test('2. Debe insertar datos completos y consistentes en todas las 15 tablas vinculadas', async () => {
    const ids = createFixtureIds();

    // 1. Planes_Facturacion
    const plan = samplePlan(ids.planId);
    await client.query(
      `INSERT INTO planes_facturacion (id, nombre, precio_mensual, precio_anual, descuento_anual, caracteristicas, activo)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [plan.id, plan.nombre, plan.precio_mensual, plan.precio_anual, plan.descuento_anual, plan.caracteristicas, plan.activo]
    );

    // 2. Tenants
    const tenant = sampleTenant(ids.tenantId, ids.planId);
    await client.query(
      `INSERT INTO tenants (id, nombre, plan_id, estado) VALUES ($1, $2, $3, $4)`,
      [tenant.id, tenant.nombre, tenant.plan_id, tenant.estado]
    );

    // 3. Usuarios
    const adminUser = sampleUsuario(ids.usuarioAdminId, ids.tenantId, 'admin');
    await client.query(
      `INSERT INTO usuarios (id, tenant_id, nombre, email, password_hash, rol)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [adminUser.id, adminUser.tenant_id, adminUser.nombre, adminUser.email, adminUser.password_hash, adminUser.rol]
    );

    // 4. Notificaciones_Tokens
    await client.query(
      `INSERT INTO notificaciones_tokens (id, usuario_id, tipo, token, activo, expiracion)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [ids.notificacionTokenId, ids.usuarioAdminId, 'FCM_WEB', 'dummy_fcm_token_string', true, new Date(Date.now() + 86400000).toISOString()]
    );

    // 5. Historial_Planes
    await client.query(
      `INSERT INTO historial_planes (id, tenant_id, plan_id, usuario_id, metodo_pago, monto_pagado)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [ids.historialPlanId, ids.tenantId, ids.planId, ids.usuarioAdminId, 'TRANSFERENCIA', 19990.0]
    );

    // 6. Configuracion_Sistema
    await client.query(
      `INSERT INTO configuracion_sistema (id, tenant_id, clave, valor, descripcion)
       VALUES ($1, $2, $3, $4, $5)`,
      [ids.configId, ids.tenantId, 'IVA_PERCENT', '19', 'Porcentaje de IVA en Chile']
    );

    // 7. Proveedores
    const prov = sampleProveedor(ids.proveedorId, ids.tenantId);
    await client.query(
      `INSERT INTO proveedores (id, tenant_id, rut_proveedor, nombre_proveedores, dias_visita_proveedores, email, whatsapp_contacto)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [prov.id, prov.tenant_id, prov.rut_proveedor, prov.nombre_proveedores, prov.dias_visita_proveedores, prov.email, prov.whatsapp_contacto]
    );

    // 8. Catalogo_Borradores
    await client.query(
      `INSERT INTO catalogo_borradores (id, tenant_id, proveedor_id, estado_revision_catalogo, notas)
       VALUES ($1, $2, $3, $4, $5)`,
      [ids.catalogoBorradorId, ids.tenantId, ids.proveedorId, 'PENDIENTE', 'Borrador importado desde lista de precios Excel']
    );

    // 9. Productos
    const prod = sampleProducto(ids.productoId, ids.tenantId, ids.proveedorId);
    await client.query(
      `INSERT INTO productos (id, tenant_id, proveedor_id, codigo_barra, sku, nombre, stock_actual, stock_minimo, id_pos_externo, precio_compra, precio_venta, categoria, activo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [prod.id, prod.tenant_id, prod.proveedor_id, prod.codigo_barra, prod.sku, prod.nombre, prod.stock_actual, prod.stock_minimo, prod.id_pos_externo, prod.precio_compra, prod.precio_venta, prod.categoria, prod.activo]
    );

    // 10. Movimientos_Inventario_Tipos
    const movTipoCodigo = `INGRESO_${ids.movimientoTipoId.slice(0, 8).toUpperCase()}`;
    await client.query(
      `INSERT INTO movimientos_inventario_tipos (id, nombre, codigo, descripcion)
       VALUES ($1, $2, $3, $4)`,
      [ids.movimientoTipoId, 'Ingreso por Factura Proveedor', movTipoCodigo, 'Recepción física de mercadería']
    );

    // 11. Movimientos_Inventario
    await client.query(
      `INSERT INTO movimientos_inventario (id, tenant_id, producto_id, tipo_movimiento_id, cantidad, saldo_anterior, nuevo_saldo, tipo_origen, usuario_registro)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [ids.movimientoId, ids.tenantId, ids.productoId, ids.movimientoTipoId, 24.0, 24.0, 48.0, 'FACTURA_COMPRA', 'Tito Admin']
    );

    // 12. Historial_Stock
    await client.query(
      `INSERT INTO historial_stock (id, tenant_id, producto_id, cambio_anterior, nuevo_stock, cambio, tipo_movimiento, motivo, usuario_registro)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [ids.historialStockId, ids.tenantId, ids.productoId, 24.0, 48.0, 24.0, 'ingreso_factura', 'Recepción de mercadería de Distribuidora Central', 'Tito Admin']
    );

    // 13. Factura_Ingresos
    await client.query(
      `INSERT INTO factura_ingresos (id, tenant_id, proveedor_id, numero_factura, fecha_ingreso, estado, cantidad, metodo_ingreso, rut_proveedor, total)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [ids.facturaId, ids.tenantId, ids.proveedorId, 'FAC-99882', '2026-09-10', 'RECIBIDA', 24.0, 'OCR_GEMINI', prov.rut_proveedor, 20400.0]
    );

    // 14. Metodos_Pago
    const metodo = sampleMetodoPago(ids.metodoPagoId);
    await client.query(
      `INSERT INTO metodos_pago (id, nombre, descripcion, activo, pasarela)
       VALUES ($1, $2, $3, $4, $5)`,
      [metodo.id, metodo.nombre, metodo.descripcion, metodo.activo, metodo.pasarela]
    );

    // 15. Transacciones_Venta
    await client.query(
      `INSERT INTO transacciones_venta (id, tenant_id, usuario_id, folio_local_sqlite, total, unidades, estado, rut_cliente, metodo_pago_id, sync_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [ids.ventaId, ids.tenantId, ids.usuarioAdminId, 'POS-LOCAL-0001', 2980.0, 2.0, 'COMPLETADA', '18.999.888-7', ids.metodoPagoId, 'SYNCED']
    );

    // 16. Detalle_Venta
    await client.query(
      `INSERT INTO detalle_venta (id, venta_id, producto_id, cantidad, precio_unitario, subtotal)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [ids.detalleVentaId, ids.ventaId, ids.productoId, 2.0, 1490.0, 2980.0]
    );

    // Verificación de lectura completa
    const ventaRes = await client.query('SELECT * FROM transacciones_venta WHERE id = $1', [ids.ventaId]);
    expect(ventaRes.rows.length).toBe(1);
    expect(Number(ventaRes.rows[0].total)).toBe(2980.0);

    const detalleRes = await client.query('SELECT * FROM detalle_venta WHERE venta_id = $1', [ids.ventaId]);
    expect(detalleRes.rows.length).toBe(1);
    expect(Number(detalleRes.rows[0].subtotal)).toBe(2980.0);
  });

  test('3. Debe rechazar inserciones huérfanas por violación de Llave Foránea (FK)', async () => {
    const fakeTenantId = '00000000-0000-0000-0000-000000000099';
    const fakeUserId = '00000000-0000-0000-0000-000000000088';

    // Intento de insertar usuario con tenant inexistente
    await expect(
      client.query(
        `INSERT INTO usuarios (id, tenant_id, nombre, email, password_hash, rol)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [fakeUserId, fakeTenantId, 'Huerfano', 'huerfano@test.com', 'hash', 'cajero']
      )
    ).rejects.toThrow();
  });

  test('4. Debe aplicar borrado en cascada (CASCADE) cuando se elimina el Tenant', async () => {
    const ids = createFixtureIds();
    const tenant = sampleTenant(ids.tenantId2);

    await client.query(
      `INSERT INTO tenants (id, nombre, estado) VALUES ($1, $2, $3)`,
      [tenant.id, tenant.nombre, tenant.estado]
    );

    const user = sampleUsuario(ids.usuarioCajeroId, ids.tenantId2, 'cajero');
    await client.query(
      `INSERT INTO usuarios (id, tenant_id, nombre, email, password_hash, rol)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [user.id, user.tenant_id, user.nombre, user.email, user.password_hash, user.rol]
    );

    // Verificar existencia del usuario
    const preCheck = await client.query('SELECT id FROM usuarios WHERE id = $1', [user.id]);
    expect(preCheck.rows.length).toBe(1);

    // Borrar el tenant
    await client.query('DELETE FROM tenants WHERE id = $1', [ids.tenantId2]);

    // Verificar que el usuario fue eliminado en cascada
    const postCheck = await client.query('SELECT id FROM usuarios WHERE id = $1', [user.id]);
    expect(postCheck.rows.length).toBe(0);
  });

  test('5. Debe aislar los datos multi-tenant: mismo email y sku permitidos en tenants distintos', async () => {
    const tenantA = createFixtureIds().tenantId;
    const tenantB = createFixtureIds().tenantId;

    await client.query(`INSERT INTO tenants (id, nombre) VALUES ($1, $2)`, [tenantA, 'Empresa A']);
    await client.query(`INSERT INTO tenants (id, nombre) VALUES ($1, $2)`, [tenantB, 'Empresa B']);

    const sharedEmail = 'operador@comun.cl';
    const sharedSku = 'SKU-IDENTICO-01';

    // Inserción en Tenant A
    await client.query(
      `INSERT INTO usuarios (tenant_id, nombre, email, password_hash, rol) VALUES ($1, $2, $3, $4, $5)`,
      [tenantA, 'Op A', sharedEmail, 'hashA', 'cajero']
    );
    await client.query(
      `INSERT INTO productos (tenant_id, sku, nombre, precio_compra, precio_venta) VALUES ($1, $2, $3, $4, $5)`,
      [tenantA, sharedSku, 'Producto A', 100, 200]
    );

    // Inserción en Tenant B con los MISMOS email y sku (debe permitirse sin colisión)
    await client.query(
      `INSERT INTO usuarios (tenant_id, nombre, email, password_hash, rol) VALUES ($1, $2, $3, $4, $5)`,
      [tenantB, 'Op B', sharedEmail, 'hashB', 'cajero']
    );
    await client.query(
      `INSERT INTO productos (tenant_id, sku, nombre, precio_compra, precio_venta) VALUES ($1, $2, $3, $4, $5)`,
      [tenantB, sharedSku, 'Producto B', 150, 250]
    );

    // Pero duplicar dentro del MISMO tenant debe fallar por índice único compuesto
    await expect(
      client.query(
        `INSERT INTO usuarios (tenant_id, nombre, email, password_hash, rol) VALUES ($1, $2, $3, $4, $5)`,
        [tenantA, 'Op A2', sharedEmail, 'hashA2', 'cajero']
      )
    ).rejects.toThrow();
  });
});

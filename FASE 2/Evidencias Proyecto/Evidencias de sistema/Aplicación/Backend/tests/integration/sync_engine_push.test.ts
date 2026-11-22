import { PostgresClient } from '../../src/database/postgres/client';
import { SqliteClient } from '../../src/database/sqlite/client';
import { CloudSyncReceiverService } from '../../src/sync/cloud-sync-receiver.service';
import { PostgresMigrator } from '../../src/database/postgres/migrator';
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

    // credito o debito y como se devolvio viajan con la venta (migracion 024)
    sqliteClient.execute("UPDATE transacciones_venta SET tipo_tarjeta = 'CREDITO' WHERE id = ?", [saleId1]);
    sqliteClient.execute("UPDATE transacciones_venta SET medio_devolucion = 'EFECTIVO' WHERE id = ?", [saleId2]);

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

    const enLaNube = await pgClient.query<{ id: string; tipo_tarjeta: string | null; medio_devolucion: string | null }>(
      'SELECT id, tipo_tarjeta, medio_devolucion FROM transacciones_venta WHERE id IN ($1, $2)', [saleId1, saleId2]);
    const porId = new Map(enLaNube.rows.map((r) => [r.id, r]));
    expect(porId.get(saleId1)?.tipo_tarjeta).toBe('CREDITO');
    expect(porId.get(saleId2)?.medio_devolucion).toBe('EFECTIVO');

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

  test('3. Aplica las migraciones pendientes de la nube antes de la primera sincronizacion, una vez, y reintenta si fallan', async () => {
    // una caja que arranco sin nube no aplico la 024 al iniciar: la aplica antes de mandar ventas.
    // Un cliente nuevo: la espera de migraciones se recuerda por cliente y el de arriba ya migro
    const otraNube = (await createTestPostgresClient()).client;
    const migrar = jest.spyOn(PostgresMigrator.prototype, 'migrate')
      .mockRejectedValueOnce(new Error('la nube se cayo a mitad de camino'))
      .mockResolvedValue([]);
    try {
      const receptor = new CloudSyncReceiverService(otraNube);
      const lote = { tenant_id: createFixtureIds().tenantId, sales: [{ sale: { id: createFixtureIds().ventaId }, details: [] }] } as any;

      const primero = await receptor.ingestPushBatch(lote);
      expect(primero.success).toBe(false);
      await receptor.ingestPushBatch(lote);
      await receptor.ingestPushBatch(lote);

      // la primera fallo y no quedo guardada: la segunda reintenta y la tercera ya no migra
      expect(migrar).toHaveBeenCalledTimes(2);
    } finally {
      migrar.mockRestore();
      await otraNube.close();
    }
  });

  test('4. La venta de un usuario que la nube no conoce sube igual, con el usuario o con el de su mismo correo', async () => {
    // Un cajero creado sin nube no existe arriba: su venta fallaba por clave foranea en cada
    // intento hasta quedar detenida
    const ids = createFixtureIds();
    const tenant = sampleTenant(ids.tenantId);
    const metodo = sampleMetodoPago(ids.metodoPagoId);
    const soloLocal = sampleUsuario(ids.usuarioCajeroId, ids.tenantId, 'cajero');
    const mismoCorreo = sampleUsuario(createFixtureIds().usuarioCajeroId, ids.tenantId, 'cajero');
    const enLaNubeConOtroId = { ...mismoCorreo, id: createFixtureIds().usuarioCajeroId };

    await pgClient.query('INSERT INTO tenants (id, nombre, estado) VALUES ($1, $2, $3)', [tenant.id, tenant.nombre, tenant.estado]);
    await pgClient.query('INSERT INTO metodos_pago (id, nombre, descripcion, activo, pasarela) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING',
      [metodo.id, metodo.nombre, metodo.descripcion, metodo.activo, metodo.pasarela]);
    await pgClient.query('INSERT INTO usuarios (id, tenant_id, nombre, email, password_hash, rol) VALUES ($1, $2, $3, $4, $5, $6)',
      [enLaNubeConOtroId.id, tenant.id, enLaNubeConOtroId.nombre, enLaNubeConOtroId.email, enLaNubeConOtroId.password_hash, 'cajero']);

    sqliteClient.execute('INSERT INTO tenants (id, nombre, estado) VALUES (?, ?, ?)', [tenant.id, tenant.nombre, tenant.estado]);
    sqliteClient.execute('INSERT OR IGNORE INTO metodos_pago (id, nombre, descripcion, activo, pasarela) VALUES (?, ?, ?, ?, ?)',
      [metodo.id, metodo.nombre, metodo.descripcion, 1, metodo.pasarela]);
    const ventas: string[] = [];
    for (const usuario of [soloLocal, mismoCorreo]) {
      sqliteClient.execute('INSERT INTO usuarios (id, tenant_id, nombre, email, password_hash, rol) VALUES (?, ?, ?, ?, ?, ?)',
        [usuario.id, tenant.id, usuario.nombre, usuario.email, usuario.password_hash, usuario.rol]);
      const venta = createFixtureIds().ventaId;
      ventas.push(venta);
      sqliteClient.execute(
        `INSERT INTO transacciones_venta (id, tenant_id, usuario_id, folio_local_sqlite, total, unidades, estado, metodo_pago_id, is_dirty, sync_status)
         VALUES (?, ?, ?, ?, 0, 0, 'COMPLETADA', ?, 1, 'PENDING')`,
        [venta, tenant.id, usuario.id, `FOLIO-USUARIO-${ventas.length}`, metodo.id]
      );
    }

    const resultado = await posEngine.syncPush(tenant.id, async (payload) => cloudReceiver.ingestPushBatch(payload));

    expect(resultado.synced_ids).toEqual(expect.arrayContaining(ventas));
    const autores = await pgClient.query<{ id: string; usuario_id: string }>(
      'SELECT id, usuario_id FROM transacciones_venta WHERE id IN ($1, $2)', ventas);
    const autor = new Map(autores.rows.map((r) => [r.id, r.usuario_id]));
    expect(autor.get(ventas[0])).toBe(soloLocal.id);
    expect(autor.get(ventas[1])).toBe(enLaNubeConOtroId.id);
    const creado = await pgClient.query('SELECT email FROM usuarios WHERE id = $1', [soloLocal.id]);
    expect(creado.rows[0]?.email).toBe(soloLocal.email);
  });
});

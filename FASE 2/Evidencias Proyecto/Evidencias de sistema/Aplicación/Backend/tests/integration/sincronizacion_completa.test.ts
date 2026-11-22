import { v5 as uuidv5, validate as esUuid, version as versionUuid } from 'uuid';
import { PostgresClient } from '../../src/database/postgres/client';
import { SqliteClient } from '../../src/database/sqlite/client';
import { CloudSyncReceiverService } from '../../src/sync/cloud-sync-receiver.service';
import { PosSyncEngineService } from '../../src/sync/pos-sync-engine.service';
import { CierreCajaService } from '../../src/caja/cierre-caja.service';
import { LotesService } from '../../src/inventory/lotes.service';
import { createTestPostgresClient, createTestSqliteClient } from '../helpers/db-test-helper';
import { createFixtureIds, sampleMetodoPago, sampleProducto, sampleTenant, sampleUsuario } from '../helpers/fixtures';

/**
 * Lo que la revision del 22-11 encontro que no llegaba a la nube o se perdia al sincronizar: un
 * precio cambiado en la caja sin conexion lo revertia la bajada, el stock de la nube no recibia
 * devoluciones ni ajustes, los pagos se grababan antes de que la venta existiera alla, los turnos
 * de caja hechos sin nube no subian nunca, y el lote de un producto nuevo iba con el id de la caja.
 */
describe('Sincronizacion completa: ediciones, stock, pagos, caja y lotes', () => {
  let pg: PostgresClient;
  let sqlite: SqliteClient;
  let receptor: CloudSyncReceiverService;
  let motor: PosSyncEngineService;

  beforeAll(async () => {
    pg = (await createTestPostgresClient()).client;
    sqlite = createTestSqliteClient().client;
    receptor = new CloudSyncReceiverService(pg);
    motor = new PosSyncEngineService(sqlite);
  });

  afterAll(async () => {
    await pg.close();
    sqlite.close();
  });

  /** Un comercio con su usuario y su medio de pago en los dos lados, y un producto con sus dos versiones. */
  async function comercio() {
    const ids = createFixtureIds();
    const tenant = sampleTenant(ids.tenantId);
    const usuario = sampleUsuario(ids.usuarioCajeroId, ids.tenantId, 'cajero');
    const metodo = sampleMetodoPago(ids.metodoPagoId);
    await pg.query('INSERT INTO tenants (id, nombre, estado) VALUES ($1, $2, $3)', [tenant.id, tenant.nombre, tenant.estado]);
    await pg.query('INSERT INTO usuarios (id, tenant_id, nombre, email, password_hash, rol) VALUES ($1, $2, $3, $4, $5, $6)',
      [usuario.id, tenant.id, usuario.nombre, usuario.email, usuario.password_hash, usuario.rol]);
    await pg.query('INSERT INTO metodos_pago (id, nombre, descripcion, activo, pasarela) VALUES ($1, $2, $3, $4, $5)',
      [metodo.id, metodo.nombre, metodo.descripcion, metodo.activo, metodo.pasarela]);
    sqlite.execute('INSERT INTO tenants (id, nombre, estado) VALUES (?, ?, ?)', [tenant.id, tenant.nombre, tenant.estado]);
    sqlite.execute('INSERT INTO usuarios (id, tenant_id, nombre, email, password_hash, rol) VALUES (?, ?, ?, ?, ?, ?)',
      [usuario.id, tenant.id, usuario.nombre, usuario.email, usuario.password_hash, usuario.rol]);
    sqlite.execute('INSERT INTO metodos_pago (id, nombre, descripcion, activo, pasarela) VALUES (?, ?, ?, ?, ?)',
      [metodo.id, metodo.nombre, metodo.descripcion, 1, metodo.pasarela]);
    return { ids, tenant, usuario, metodo };
  }

  async function producto(tenantId: string, local: { precio: number; stock: number; editado: string }, nube: { precio: number; stock: number; editado: string }) {
    const prod = sampleProducto(createFixtureIds().productoId, tenantId);
    sqlite.execute(
      `INSERT INTO productos (id, tenant_id, sku, nombre, stock_actual, precio_compra, precio_venta, updated_at)
       VALUES (?, ?, ?, ?, ?, 500, ?, ?)`,
      [prod.id, tenantId, prod.sku, prod.nombre, local.stock, local.precio, local.editado]
    );
    await pg.query(
      `INSERT INTO productos (id, tenant_id, sku, nombre, stock_actual, precio_compra, precio_venta, updated_at)
       VALUES ($1, $2, $3, $4, $5, 500, $6, $7)`,
      [prod.id, tenantId, prod.sku, prod.nombre, nube.stock, nube.precio, nube.editado]
    );
    return prod;
  }

  /** Lo que hace /pos/sync con el catalogo: ventas, respaldo del catalogo y bajada. */
  async function sincronizar(tenantId: string) {
    await motor.syncPush(tenantId, (payload) => receptor.ingestPushBatch(payload));
    await motor.respaldarCatalogoEnNube(tenantId, (t, p, v) => receptor.respaldarCatalogo(t, p, v));
    await motor.syncPullCatalog(tenantId, (req) => receptor.getPullUpdates(req.tenant_id, req.last_pull_timestamp));
  }

  const enNube = async (id: string) =>
    (await pg.query<{ precio_venta: string; stock_actual: string }>('SELECT precio_venta, stock_actual FROM productos WHERE id = $1', [id])).rows[0];
  const enCaja = (id: string) =>
    sqlite.queryOne<{ precio_venta: number; stock_actual: number }>('SELECT precio_venta, stock_actual FROM productos WHERE id = ?', [id])!;

  function vender(tenantId: string, usuarioId: string, metodoId: string, productoId: string, cantidad: number) {
    const ventaId = createFixtureIds().ventaId;
    sqlite.execute(
      `INSERT INTO transacciones_venta (id, tenant_id, usuario_id, folio_local_sqlite, total, unidades, estado, metodo_pago_id, is_dirty, sync_status)
       VALUES (?, ?, ?, ?, 1000, ?, 'COMPLETADA', ?, 1, 'PENDING')`,
      [ventaId, tenantId, usuarioId, `F-${ventaId.slice(0, 6)}`, cantidad, metodoId]
    );
    sqlite.execute('INSERT INTO detalle_venta (id, venta_id, producto_id, cantidad, precio_unitario, subtotal) VALUES (?, ?, ?, ?, 1000, 1000)',
      [createFixtureIds().detalleVentaId, ventaId, productoId, cantidad]);
    sqlite.execute('UPDATE productos SET stock_actual = stock_actual - ? WHERE id = ?', [cantidad, productoId]);
    return ventaId;
  }

  test('un precio cambiado en la caja sin conexion sobrevive a vender el producto y sincronizar', async () => {
    const { ids } = await comercio();
    // la caja edito a las 12:00; la nube tiene la version de las 10:00
    const prod = await producto(ids.tenantId,
      { precio: 1500, stock: 10, editado: '2026-11-22 12:00:00' },
      { precio: 1000, stock: 10, editado: '2026-11-22T10:00:00Z' });
    vender(ids.tenantId, ids.usuarioCajeroId, ids.metodoPagoId, prod.id, 1);

    await sincronizar(ids.tenantId);

    expect(Number((await enNube(prod.id)).precio_venta)).toBe(1500);
    expect(Number(enCaja(prod.id).precio_venta)).toBe(1500);
  });

  test('un precio cambiado despues en la nube baja, aunque la caja haya movido stock', async () => {
    const { ids } = await comercio();
    const prod = await producto(ids.tenantId,
      { precio: 1500, stock: 10, editado: '2026-11-22 10:00:00' },
      { precio: 2000, stock: 10, editado: '2026-11-22T12:00:00Z' });
    // un ajuste de stock en la caja no marca edicion: solo cambia el stock
    sqlite.execute('UPDATE productos SET stock_actual = 7 WHERE id = ?', [prod.id]);

    await sincronizar(ids.tenantId);

    expect(Number((await enNube(prod.id)).precio_venta)).toBe(2000);
    expect(Number(enCaja(prod.id).precio_venta)).toBe(2000);
    // la caja guarda la marca de la nube: si guardara la hora de la bajada, la siguiente
    // sincronizacion veria la caja mas nueva sin que nadie la haya editado
    expect(sqlite.queryOne<{ u: string }>('SELECT updated_at AS u FROM productos WHERE id = ?', [prod.id])!.u).toBe('2026-11-22 12:00:00');
  });

  test('la bajada sola no pisa una edicion de la caja mas nueva que la de la nube', async () => {
    const { ids } = await comercio();
    const prod = await producto(ids.tenantId,
      { precio: 1500, stock: 10, editado: '2026-11-22 12:00:00' },
      { precio: 1000, stock: 10, editado: '2026-11-22T10:00:00Z' });

    await motor.syncPullCatalog(ids.tenantId, (req) => receptor.getPullUpdates(req.tenant_id, req.last_pull_timestamp));

    expect(Number(enCaja(prod.id).precio_venta)).toBe(1500);
  });

  test('en el stock manda la caja: la nube queda con el de la caja despues de devoluciones y ajustes', async () => {
    const { ids } = await comercio();
    const prod = await producto(ids.tenantId,
      { precio: 1000, stock: 10, editado: '2026-11-22 10:00:00' },
      { precio: 1000, stock: 10, editado: '2026-11-22T10:00:00Z' });
    vender(ids.tenantId, ids.usuarioCajeroId, ids.metodoPagoId, prod.id, 3);
    // devolucion de 2 y un ajuste de conteo, ambos solo en la caja
    sqlite.execute('UPDATE productos SET stock_actual = stock_actual + 2 WHERE id = ?', [prod.id]);
    sqlite.execute('UPDATE productos SET stock_actual = stock_actual + 4 WHERE id = ?', [prod.id]);

    await sincronizar(ids.tenantId);

    expect(Number(enCaja(prod.id).stock_actual)).toBe(13);
    expect(Number((await enNube(prod.id)).stock_actual)).toBe(13);
  });

  test('los pagos suben con su venta, tambien los de una venta que ya estaba en la nube', async () => {
    const { ids } = await comercio();
    const prod = await producto(ids.tenantId,
      { precio: 1000, stock: 10, editado: '2026-11-22 10:00:00' },
      { precio: 1000, stock: 10, editado: '2026-11-22T10:00:00Z' });
    const nueva = vender(ids.tenantId, ids.usuarioCajeroId, ids.metodoPagoId, prod.id, 1);
    const yaSubida = vender(ids.tenantId, ids.usuarioCajeroId, ids.metodoPagoId, prod.id, 1);
    await pg.query(
      `INSERT INTO transacciones_venta (id, tenant_id, usuario_id, folio_local_sqlite, total, unidades, estado, metodo_pago_id)
       VALUES ($1, $2, $3, 'SUBIDA-ANTES', 1000, 1, 'COMPLETADA', $4)`,
      [yaSubida, ids.tenantId, ids.usuarioCajeroId, ids.metodoPagoId]
    );
    // el id de Mercado Pago no es un UUID
    for (const [venta, idPasarela] of [[nueva, 'MP-1234567890'], [yaSubida, 'MP-9876543210']]) {
      sqlite.execute(
        `INSERT INTO payment_transactions (id, sale_id, pasarela, transaction_token, monto, estado_transaccion, metadata_response)
         VALUES (?, ?, 'MercadoPago', ?, 1000, 'APPROVED', '{"order_status":"processed"}')`,
        [idPasarela, venta, `ORD-${idPasarela}`]
      );
    }

    await motor.syncPush(ids.tenantId, (payload) => receptor.ingestPushBatch(payload));
    await motor.syncPush(ids.tenantId, (payload) => receptor.ingestPushBatch(payload));

    const pagos = await pg.query<{ id: string; sale_id: string; transaction_token: string }>(
      'SELECT id, sale_id, transaction_token FROM payment_transactions WHERE sale_id IN ($1, $2)', [nueva, yaSubida]);
    expect(pagos.rows.map((p) => p.transaction_token).sort()).toEqual(['ORD-MP-1234567890', 'ORD-MP-9876543210']);
    for (const pago of pagos.rows) {
      expect(esUuid(pago.id) && versionUuid(pago.id)).toBe(5);
    }
    expect(pagos.rows.find((p) => p.sale_id === nueva)!.id).toBe(uuidv5('MP-1234567890', '6b1d2f3e-4a5c-4e7d-9f80-1a2b3c4d5e6f'));
  });

  test('los turnos de caja hechos sin nube suben con sus movimientos y correcciones, sin duplicarse', async () => {
    const { ids } = await comercio();
    // un administrador creado sin nube, que corrigio el cierre
    const admin = sampleUsuario(createFixtureIds().usuarioCajeroId, ids.tenantId, 'admin');
    sqlite.execute('INSERT INTO usuarios (id, tenant_id, nombre, email, password_hash, rol) VALUES (?, ?, ?, ?, ?, ?)',
      [admin.id, ids.tenantId, admin.nombre, admin.email, admin.password_hash, admin.rol]);
    const cierreId = createFixtureIds().ventaId;
    sqlite.execute(
      `INSERT INTO cierres_caja (id, tenant_id, usuario_id, fecha_apertura, fecha_cierre, monto_apertura, total_ventas,
         monto_esperado_efectivo, monto_real_efectivo, diferencia_efectivo, estado, monto_corregido_efectivo,
         diferencia_corregida, corregido_por, corregido_at)
       VALUES (?, ?, ?, '2026-11-22 12:00:00', '2026-11-22 20:00:00', 20000, 5000, 25000, 24000, -1000, 'CERRADA',
         25000, 0, ?, '2026-11-22T21:00:00.000Z')`,
      [cierreId, ids.tenantId, admin.id, admin.id]
    );
    sqlite.execute(
      `INSERT INTO caja_movimientos (id, tenant_id, sesion_caja_id, tipo, monto, motivo, usuario_id, created_at)
       VALUES (?, ?, ?, 'EGRESO', 5000, 'Retiro de seguridad', ?, '2026-11-22 15:00:00')`,
      [createFixtureIds().ventaId, ids.tenantId, cierreId, ids.usuarioCajeroId]
    );
    sqlite.execute(
      `INSERT INTO correcciones_cierre_caja (id, correlativo, tenant_id, cierre_id, monto_anterior, monto_nuevo, motivo, usuario_id, created_at)
       VALUES (?, 1, ?, ?, 24000, 25000, 'Se conto mal un billete', ?, '2026-11-22T21:00:00.000Z')`,
      [createFixtureIds().ventaId, ids.tenantId, cierreId, admin.id]
    );

    const caja = new CierreCajaService(pg, sqlite);
    const primero = await caja.respaldarEnNube(ids.tenantId);
    const segundo = await caja.respaldarEnNube(ids.tenantId);

    expect(primero).toEqual({ cierres: 1, movimientos: 1, correcciones: 1, omitidos: 0 });
    expect(segundo).toEqual({ cierres: 1, movimientos: 0, correcciones: 0, omitidos: 0 });
    // el turno lo abrio un administrador creado sin nube: sube con el
    expect((await pg.query<{ usuario_id: string }>('SELECT usuario_id FROM cierres_caja WHERE id = $1', [cierreId])).rows[0].usuario_id).toBe(admin.id);

    // un cierre que cambia despues de subir (otra correccion) se actualiza en la nube
    sqlite.execute('UPDATE cierres_caja SET monto_corregido_efectivo = 26000 WHERE id = ?', [cierreId]);
    await caja.respaldarEnNube(ids.tenantId);
    expect(Number((await pg.query<{ m: string }>('SELECT monto_corregido_efectivo AS m FROM cierres_caja WHERE id = $1', [cierreId])).rows[0].m)).toBe(26000);
    sqlite.execute('UPDATE cierres_caja SET monto_corregido_efectivo = 25000 WHERE id = ?', [cierreId]);
    await caja.respaldarEnNube(ids.tenantId);
    const cierre = (await pg.query<{ monto_corregido_efectivo: string; corregido_por: string; fecha_apertura: Date }>(
      'SELECT monto_corregido_efectivo, corregido_por, fecha_apertura FROM cierres_caja WHERE id = $1', [cierreId])).rows[0];
    expect(Number(cierre.monto_corregido_efectivo)).toBe(25000);
    expect(cierre.corregido_por).toBe(admin.id);
    // la hora de la caja es UTC: en la nube no se corre de zona
    expect(new Date(cierre.fecha_apertura).toISOString()).toBe('2026-11-22T12:00:00.000Z');
    const contar = async (tabla: string) =>
      Number((await pg.query<{ n: string }>(`SELECT COUNT(*) AS n FROM ${tabla} WHERE cierre_id = $1`.replace('cierre_id', tabla === 'caja_movimientos' ? 'sesion_caja_id' : 'cierre_id'), [cierreId])).rows[0].n);
    expect(await contar('caja_movimientos')).toBe(1);
    expect(await contar('correcciones_cierre_caja')).toBe(1);
  });

  test('el lote de una factura va con el producto de la nube, y sin el producto se salta', async () => {
    const { ids } = await comercio();
    const prod = sampleProducto(createFixtureIds().productoId, ids.tenantId);
    const idEnNube = createFixtureIds().productoId;
    // la factura escribio el producto en la nube con su propio id
    await pg.query(
      `INSERT INTO productos (id, tenant_id, sku, nombre, stock_actual, precio_compra, precio_venta) VALUES ($1, $2, $3, $4, 0, 500, 1000)`,
      [idEnNube, ids.tenantId, prod.sku, prod.nombre]
    );
    const lotes = new LotesService(sqlite);

    await lotes.registrarEnNube(ids.tenantId, prod.id, 6, '2027-01-31', 'L-1', 'F-100', pg, prod.sku);
    await lotes.registrarEnNube(ids.tenantId, createFixtureIds().productoId, 3, '2027-01-31', 'L-2', 'F-100', pg, 'SKU-QUE-NO-ESTA');

    const enLaNube = await pg.query<{ producto_id: string; codigo_lote: string }>(
      "SELECT producto_id, codigo_lote FROM lotes WHERE tenant_id = $1 AND factura_origen_folio = 'F-100'", [ids.tenantId]);
    expect(enLaNube.rows).toEqual([{ producto_id: idEnNube, codigo_lote: 'L-1' }]);
  });
});

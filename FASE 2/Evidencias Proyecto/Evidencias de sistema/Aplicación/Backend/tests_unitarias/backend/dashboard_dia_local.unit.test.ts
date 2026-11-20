import path from 'path';
import { SqliteClient } from '../../backend/src/database/sqlite/client';
import { SqliteMigrator } from '../../backend/src/database/sqlite/migrator';
import { DashboardService } from '../../backend/src/analytics/dashboard.service';

describe('Pruebas Unitarias: el panel cuenta el dia del reloj local', () => {
  const TENANT = 'b6a1c0de-0000-4000-8000-000000000001';
  const USUARIO = 'b6a1c0de-0000-4000-8000-000000000002';
  let sqlite: SqliteClient;

  // La venta se guarda como la guarda la caja: datetime('now'), es decir en UTC
  const enUtc = (d: Date) => d.toISOString().replace('T', ' ').slice(0, 19);

  beforeAll(() => {
    sqlite = new SqliteClient(':memory:', true);
    new SqliteMigrator(sqlite, path.resolve(__dirname, '../../backend/src/database/sqlite/migrations')).migrate();
    sqlite.execute('INSERT INTO tenants (id, nombre, estado) VALUES (?, ?, ?)', [TENANT, 'Local del panel', 'ACTIVO']);
    sqlite.execute(
      'INSERT INTO usuarios (id, tenant_id, nombre, email, password_hash, rol) VALUES (?, ?, ?, ?, ?, ?)',
      [USUARIO, TENANT, 'Cajera', 'cajera@panel.cl', 'x', 'cajero']
    );

    const hoy = new Date();
    const hoyTemprano = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 0, 30);
    const ayerTarde = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 1, 23, 30);
    const vender = (id: string, total: number, cuando: Date) =>
      sqlite.execute(
        `INSERT INTO transacciones_venta (id, tenant_id, usuario_id, folio_local_sqlite, total, unidades, estado, is_dirty, sync_status, fecha)
         VALUES (?, ?, ?, ?, ?, 1, 'COMPLETADA', 0, 'SYNCED', ?)`,
        [id, TENANT, USUARIO, id, total, enUtc(cuando)]
      );
    vender('b6a1c0de-0000-4000-8000-0000000000a1', 1000, hoyTemprano);
    vender('b6a1c0de-0000-4000-8000-0000000000a2', 5000, ayerTarde);
  });

  afterAll(() => sqlite.close());

  test('las ventas de hoy son las del dia local: la de anoche no entra', () => {
    const panel = new DashboardService(sqlite).getOverview({ tenantId: TENANT, periodo: 'diario' });
    expect(panel.kpis.totalTransacciones).toBe(1);
    expect(panel.kpis.totalVentasBruto).toBe(1000);
  });

  test('el historico cuenta las dos', () => {
    const panel = new DashboardService(sqlite).getOverview({ tenantId: TENANT, periodo: 'historico' });
    expect(panel.kpis.totalTransacciones).toBe(2);
  });
});

// El panel sumaba el total de la venta una vez por cada linea del detalle: con tres productos en
// una boleta mostraba el triple de lo vendido, y como el costo si estaba bien sumado, el margen y
// el ticket promedio salian inventados. Las pruebas de arriba no lo veian porque sus ventas no
// tienen detalle, y sin detalle el LEFT JOIN deja una sola fila por venta.
describe('Pruebas Unitarias: el panel no multiplica la venta por sus lineas', () => {
  const TENANT = 'b6a1c0de-0000-4000-8000-0000000000f1';
  const USUARIO = 'b6a1c0de-0000-4000-8000-0000000000f2';
  const VENTA = 'b6a1c0de-0000-4000-8000-0000000000f3';
  // precio de venta y de compra de cada linea de la boleta
  const LINEAS: [number, number][] = [[1000, 600], [2000, 1200], [3000, 1800]];
  let sqlite: SqliteClient;

  beforeAll(() => {
    sqlite = new SqliteClient(':memory:', true);
    new SqliteMigrator(sqlite, path.resolve(__dirname, '../../backend/src/database/sqlite/migrations')).migrate();
    sqlite.execute('INSERT INTO tenants (id, nombre, estado) VALUES (?, ?, ?)', [TENANT, 'Local del margen', 'ACTIVO']);
    sqlite.execute(
      'INSERT INTO usuarios (id, tenant_id, nombre, email, password_hash, rol) VALUES (?, ?, ?, ?, ?, ?)',
      [USUARIO, TENANT, 'Cajera', 'cajera@margen.cl', 'x', 'cajero']
    );
    sqlite.execute(
      `INSERT INTO transacciones_venta (id, tenant_id, usuario_id, folio_local_sqlite, total, unidades, estado, is_dirty, sync_status, fecha)
       VALUES (?, ?, ?, ?, 6000, 3, 'COMPLETADA', 0, 'SYNCED', datetime('now'))`,
      [VENTA, TENANT, USUARIO, VENTA]
    );

    LINEAS.forEach(([precioVenta, precioCompra], i) => {
      const producto = 'b6a1c0de-0000-4000-8000-0000000000e' + i;
      sqlite.execute(
        `INSERT INTO productos (id, tenant_id, sku, nombre, stock_actual, stock_minimo, precio_compra, precio_venta, activo)
         VALUES (?, ?, ?, ?, 10, 1, ?, ?, 1)`,
        [producto, TENANT, 'SKU-' + i, 'Producto ' + i, precioCompra, precioVenta]
      );
      sqlite.execute(
        `INSERT INTO detalle_venta (id, venta_id, producto_id, cantidad, precio_unitario, subtotal)
         VALUES (?, ?, ?, 1, ?, ?)`,
        ['b6a1c0de-0000-4000-8000-0000000000d' + i, VENTA, producto, precioVenta, precioVenta]
      );
    });
  });

  afterAll(() => sqlite.close());

  test('una boleta de tres lineas vale lo que cobro, no el triple', () => {
    const panel = new DashboardService(sqlite).getOverview({ tenantId: TENANT, periodo: 'historico' });

    expect(panel.kpis.totalTransacciones).toBe(1);
    expect(panel.kpis.totalVentasBruto).toBe(6000);
    expect(panel.kpis.ticketPromedio).toBe(6000);
  });

  test('las unidades y el costo si se suman por linea', () => {
    const panel = new DashboardService(sqlite).getOverview({ tenantId: TENANT, periodo: 'historico' });

    expect(panel.kpis.unidadesVendidas).toBe(3);
    expect(panel.kpis.costoTotalVendido).toBe(3600);
  });

  test('el margen sale de lo vendido y lo costado, las dos cosas bien medidas', () => {
    const panel = new DashboardService(sqlite).getOverview({ tenantId: TENANT, periodo: 'historico' });
    const neto = Math.round(6000 / 1.19);

    expect(panel.kpis.totalVentasNeto).toBe(neto);
    expect(panel.kpis.utilidadBruta).toBe(neto - 3600);
    expect(panel.kpis.margenUtilidadPorc).toBe(Math.round(((neto - 3600) / neto) * 100));
  });
});

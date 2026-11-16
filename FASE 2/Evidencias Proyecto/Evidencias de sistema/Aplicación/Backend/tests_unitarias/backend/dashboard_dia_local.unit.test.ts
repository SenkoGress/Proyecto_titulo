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

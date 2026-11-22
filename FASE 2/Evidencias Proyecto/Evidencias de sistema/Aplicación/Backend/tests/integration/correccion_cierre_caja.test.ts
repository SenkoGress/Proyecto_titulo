import http from 'http';
import app from '../../src/index';
import { initializeDatabase } from '../../src/database/init-db';
import { defaultSqliteClient, SqliteClient } from '../../src/database/sqlite/client';
import { PostgresClient } from '../../src/database/postgres/client';
import { CierreCajaService } from '../../src/caja/cierre-caja.service';
import { PostgresMigrator } from '../../src/database/postgres/migrator';
import { createTestPostgresClient, createTestSqliteClient } from '../helpers/db-test-helper';
import { createFixtureIds, sampleMetodoPago, sampleTenant, sampleUsuario } from '../helpers/fixtures';

const TENANT = '00000000-0000-0000-0000-000000000001';
const ADMIN = '00000000-0000-0000-0000-000000000002';
const CAJERO = '00000000-0000-0000-0000-000000000003';

/**
 * El administrador corrige el conteo del efectivo de un cierre ya hecho. El conteo y la diferencia
 * originales no se tocan: cada correccion queda en un rastro que solo crece.
 */
describe('Correccion del conteo de un cierre de caja', () => {
  let servidor: http.Server;
  let base: string;
  let tokenAdmin = '';
  let tokenCajero = '';
  let cierreId = '';

  const pedir = async (metodo: string, ruta: string, cuerpo?: unknown, token?: string) => {
    const res = await fetch(`${base}/api/v1${ruta}`, {
      method: metodo,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo)
    });
    return { status: res.status, json: (await res.json()) as any };
  };
  const cierre = () => defaultSqliteClient.queryOne<any>('SELECT * FROM cierres_caja WHERE id = ?', [cierreId])!;
  const corregir = (cuerpo: Record<string, unknown>, token = tokenAdmin, id = cierreId) =>
    pedir('POST', `/caja/cierres/${id}/correccion`, { tenant_id: TENANT, usuario_id: ADMIN, ...cuerpo }, token);

  beforeAll(async () => {
    await initializeDatabase();
    await new Promise<void>((listo) => {
      servidor = app.listen(0, () => {
        base = `http://127.0.0.1:${(servidor.address() as any).port}`;
        listo();
      });
    });
    tokenAdmin = (await pedir('POST', '/auth/login', { tenant_id: TENANT, email: 'admin@gestock.cl', password: 'admin123' })).json.token;
    tokenCajero = (await pedir('POST', '/auth/login', { tenant_id: TENANT, email: 'cajero@gestock.cl', password: 'cajero123' })).json.token;

    // un turno que se cierra contando 100 pesos de menos
    defaultSqliteClient.execute("UPDATE cierres_caja SET estado = 'CERRADA' WHERE tenant_id = ? AND estado = 'ABIERTA'", [TENANT]);
    await pedir('POST', '/caja/abrir', { tenant_id: TENANT, usuario_id: ADMIN, monto_apertura: 20000 }, tokenAdmin);
    const cerrado = await pedir('POST', '/caja/cerrar', { tenant_id: TENANT, usuario_id: ADMIN, monto_real_efectivo: 19900 }, tokenAdmin);
    cierreId = cerrado.json.data.id;
  });

  afterAll(async () => {
    await new Promise((listo) => servidor.close(listo));
  });

  test('el administrador corrige y el conteo original no cambia', async () => {
    const res = await corregir({ monto_real_efectivo: 20000, motivo: 'Faltaba un billete de mil que estaba bajo la gaveta' });

    expect(res.status).toBe(200);
    const c = cierre();
    expect(Number(c.monto_real_efectivo)).toBe(19900);
    expect(Number(c.diferencia_efectivo)).toBe(-100);
    expect(Number(c.monto_corregido_efectivo)).toBe(20000);
    expect(Number(c.diferencia_corregida)).toBe(0);
    expect(res.json.data.correccion).toMatchObject({ correlativo: 1, monto_anterior: 19900, monto_nuevo: 20000 });
  });

  test('dos correcciones dejan dos registros en orden, y la ultima manda', async () => {
    const res = await corregir({ monto_real_efectivo: 20500, motivo: 'Se conto de nuevo con el supervisor' });

    expect(res.status).toBe(200);
    expect(Number(cierre().monto_corregido_efectivo)).toBe(20500);
    const rastro = await pedir('GET', `/caja/cierres/${cierreId}/correcciones?tenant_id=${TENANT}`, undefined, tokenAdmin);
    expect(rastro.json.data.map((r: any) => [r.correlativo, Number(r.monto_anterior), Number(r.monto_nuevo)])).toEqual([
      [1, 19900, 20000],
      [2, 20000, 20500]
    ]);
    // el conteo original sigue intacto
    expect(Number(cierre().monto_real_efectivo)).toBe(19900);
  });

  test('el autor es el administrador de la sesion, no el usuario que venga en la peticion', async () => {
    const res = await corregir({ usuario_id: CAJERO, monto_real_efectivo: 20400, motivo: 'Ajuste' });

    expect(res.status).toBe(200);
    expect(cierre().corregido_por).toBe(ADMIN);
    expect(res.json.data.correccion.usuario_id).toBe(ADMIN);
  });

  test('el cajero no puede corregir ni ver el rastro', async () => {
    expect((await corregir({ monto_real_efectivo: 1, motivo: 'x' }, tokenCajero)).status).toBe(403);
    expect((await pedir('GET', `/caja/cierres/${cierreId}/correcciones?tenant_id=${TENANT}`, undefined, tokenCajero)).status).toBe(403);
  });

  test('sin motivo, sin monto, con un cierre que no existe o con el turno abierto se rechaza', async () => {
    const sinMotivo = await corregir({ monto_real_efectivo: 20000, motivo: '  ' });
    expect([sinMotivo.status, sinMotivo.json.error]).toEqual([400, 'MOTIVO_REQUERIDO']);
    expect((await corregir({ motivo: 'sin monto' })).status).toBe(400);
    expect((await corregir({ monto_real_efectivo: -5, motivo: 'negativo' })).status).toBe(400);
    expect((await corregir({ monto_real_efectivo: 1, motivo: 'otro' }, tokenAdmin, '11111111-2222-4333-8444-555555555555')).status).toBe(404);

    const abierto = await pedir('POST', '/caja/abrir', { tenant_id: TENANT, usuario_id: ADMIN, monto_apertura: 5000 }, tokenAdmin);
    const res = await corregir({ monto_real_efectivo: 5000, motivo: 'todavia abierto' }, tokenAdmin, abierto.json.data.id);
    expect([res.status, res.json.error]).toEqual([409, 'TURNO_ABIERTO']);
    defaultSqliteClient.execute("UPDATE cierres_caja SET estado = 'CERRADA' WHERE id = ?", [abierto.json.data.id]);
  });

  test('el cierre de otro comercio no se corrige ni muestra su rastro', async () => {
    const otro = '11111111-aaaa-4bbb-8ccc-000000000099';
    defaultSqliteClient.execute("INSERT OR IGNORE INTO tenants (id, nombre, estado) VALUES (?, 'Otro almacen', 'ACTIVO')", [otro]);
    defaultSqliteClient.execute(
      `INSERT INTO cierres_caja (id, tenant_id, usuario_id, monto_apertura, monto_esperado_efectivo, monto_real_efectivo, diferencia_efectivo, estado)
       VALUES ('cierre-de-otro', ?, ?, 0, 1000, 1000, 0, 'CERRADA')`,
      [otro, ADMIN]
    );
    defaultSqliteClient.execute(
      `INSERT INTO correcciones_cierre_caja (id, correlativo, tenant_id, cierre_id, monto_anterior, monto_nuevo, motivo, usuario_id)
       VALUES ('correccion-de-otro', 1, ?, 'cierre-de-otro', 1000, 900, 'del otro', ?)`,
      [otro, ADMIN]
    );

    expect((await corregir({ monto_real_efectivo: 5, motivo: 'ajeno' }, tokenAdmin, 'cierre-de-otro')).status).toBe(404);
    const rastro = await pedir('GET', `/caja/cierres/cierre-de-otro/correcciones?tenant_id=${TENANT}`, undefined, tokenAdmin);
    expect(rastro.json.data).toEqual([]);
  });

  test('el historial muestra el ultimo motivo y quien corrigio, y el respaldo contable lleva el rastro', async () => {
    const historial = await pedir('GET', `/caja/historial?tenant_id=${TENANT}`, undefined, tokenAdmin);
    const fila = historial.json.data.find((c: any) => c.id === cierreId);
    expect(fila.motivo_correccion).toBe('Ajuste');
    expect(fila.corregido_por_nombre).toBeTruthy();

    const respaldo = await pedir('GET', `/dte/backup/export?tenantId=${TENANT}`, undefined, tokenAdmin);
    const cuerpo = respaldo.json.data ?? respaldo.json;
    expect(cuerpo.totales_registros.correcciones_cierre_caja).toBeGreaterThanOrEqual(3);
  });

  test('un administrador que solo corrigio un cierre se desactiva en vez de borrarse', async () => {
    const alta = await pedir('POST', '/auth/register',
      { tenant_id: TENANT, nombre: 'Supervisora de prueba', email: 'supervisora.correccion@gestock.cl', password: 'clave-segura-1', rol: 'admin' }, tokenAdmin);
    const id = alta.json.data?.id ?? alta.json.user?.id ?? alta.json.data?.usuario?.id;
    expect(id).toBeTruthy();
    const token = (await pedir('POST', '/auth/login', { tenant_id: TENANT, email: 'supervisora.correccion@gestock.cl', password: 'clave-segura-1' })).json.token;
    expect((await corregir({ monto_real_efectivo: 20300, motivo: 'Revision de la supervisora' }, token)).status).toBe(200);

    expect((await pedir('DELETE', `/auth/users/${id}?tenant_id=${TENANT}`, undefined, tokenAdmin)).status).toBe(200);
    const usuario = defaultSqliteClient.queryOne<{ activo: number }>('SELECT activo FROM usuarios WHERE id = ?', [id]);
    expect(usuario).toBeTruthy();
    expect(Number(usuario!.activo)).toBe(0);
  });
});

describe('La copia del cierre y de su correccion en la nube', () => {
  let pg: PostgresClient;
  let sq: SqliteClient;
  let servicio: CierreCajaService;
  const ids = createFixtureIds();
  const enLaNube = async (sql: string, valores: unknown[]) => (await pg.query<any>(sql, valores)).rows;
  const cierreEnLosDos = async (id: string, estado: string, apertura: string) => {
    sq.execute(
      `INSERT INTO cierres_caja (id, tenant_id, usuario_id, fecha_apertura, monto_apertura, monto_esperado_efectivo, monto_real_efectivo, diferencia_efectivo, estado)
       VALUES (?, ?, ?, ${apertura}, 20000, 20000, 19900, -100, ?)`,
      [id, ids.tenantId, ids.usuarioAdminId, estado]
    );
    await pg.query(
      `INSERT INTO cierres_caja (id, tenant_id, usuario_id, monto_apertura, monto_esperado_efectivo, monto_real_efectivo, diferencia_efectivo, estado)
       VALUES ($1, $2, $3, 20000, 20000, 19900, -100, $4)`,
      [id, ids.tenantId, ids.usuarioAdminId, estado]
    );
  };

  beforeAll(async () => {
    pg = (await createTestPostgresClient()).client;
    sq = createTestSqliteClient().client;
    servicio = new CierreCajaService(pg, sq);
    const tenant = sampleTenant(ids.tenantId);
    const admin = sampleUsuario(ids.usuarioAdminId, ids.tenantId, 'admin');
    const metodo = sampleMetodoPago(ids.metodoPagoId);
    await pg.query('INSERT INTO tenants (id, nombre, estado) VALUES ($1, $2, $3)', [tenant.id, tenant.nombre, tenant.estado]);
    await pg.query('INSERT INTO usuarios (id, tenant_id, nombre, email, password_hash, rol) VALUES ($1, $2, $3, $4, $5, $6)',
      [admin.id, admin.tenant_id, admin.nombre, admin.email, admin.password_hash, admin.rol]);
    sq.execute('INSERT INTO tenants (id, nombre, estado) VALUES (?, ?, ?)', [tenant.id, tenant.nombre, tenant.estado]);
    sq.execute('INSERT INTO usuarios (id, tenant_id, nombre, email, password_hash, rol) VALUES (?, ?, ?, ?, ?, ?)',
      [admin.id, admin.tenant_id, admin.nombre, admin.email, admin.password_hash, admin.rol]);
    sq.execute('INSERT INTO metodos_pago (id, nombre, descripcion, activo, pasarela) VALUES (?, ?, ?, ?, ?)',
      [metodo.id, metodo.nombre, metodo.descripcion, 1, metodo.pasarela]);
  });

  afterAll(async () => {
    await pg.close();
    sq.close();
  });

  test('la correccion llega a la nube con su rastro, y el conteo original de la nube no cambia', async () => {
    const id = createFixtureIds().ventaId;
    await cierreEnLosDos(id, 'CERRADA', "datetime('now', '-2 hours')");

    await servicio.corregirCierre(ids.tenantId, id, ids.usuarioAdminId, 20000, 'Recuento');
    await servicio.corregirCierre(ids.tenantId, id, ids.usuarioAdminId, 20100, 'Segundo recuento');

    const [cierre] = await enLaNube('SELECT monto_real_efectivo, monto_corregido_efectivo, corregido_por FROM cierres_caja WHERE id = $1', [id]);
    expect(Number(cierre.monto_real_efectivo)).toBe(19900);
    expect(Number(cierre.monto_corregido_efectivo)).toBe(20100);
    expect(cierre.corregido_por).toBe(ids.usuarioAdminId);
    const rastro = await enLaNube('SELECT correlativo, motivo FROM correcciones_cierre_caja WHERE cierre_id = $1 ORDER BY correlativo', [id]);
    expect(rastro.map((r: any) => [Number(r.correlativo), r.motivo])).toEqual([[1, 'Recuento'], [2, 'Segundo recuento']]);
  });

  test('la nube no vuelve a una correccion anterior si llega tarde', async () => {
    const id = createFixtureIds().ventaId;
    await cierreEnLosDos(id, 'CERRADA', "datetime('now', '-2 hours')");
    // la nube ya tiene una correccion posterior a la que se va a copiar
    await pg.query(
      `INSERT INTO correcciones_cierre_caja (id, correlativo, tenant_id, cierre_id, monto_anterior, monto_nuevo, motivo, usuario_id)
       VALUES ($1, 5, $2, $3, 19900, 30000, 'posterior', $4)`,
      [createFixtureIds().ventaId, ids.tenantId, id, ids.usuarioAdminId]
    );
    await pg.query('UPDATE cierres_caja SET monto_corregido_efectivo = 30000 WHERE id = $1', [id]);

    await servicio.corregirCierre(ids.tenantId, id, ids.usuarioAdminId, 20000, 'llega tarde');

    const [cierre] = await enLaNube('SELECT monto_corregido_efectivo FROM cierres_caja WHERE id = $1', [id]);
    expect(Number(cierre.monto_corregido_efectivo)).toBe(30000);
  });

  test('la correccion y el cierre aplican las migraciones pendientes de la nube antes de copiar', async () => {
    // una caja que arranco sin nube no aplico la 024: el cierre y la correccion escriben columnas de ella
    const nubeA = (await createTestPostgresClient()).client;
    const nubeB = (await createTestPostgresClient()).client;
    const migrar = jest.spyOn(PostgresMigrator.prototype, 'migrate').mockResolvedValue([]);
    try {
      const cerrado = createFixtureIds().ventaId;
      sq.execute(
        `INSERT INTO cierres_caja (id, tenant_id, usuario_id, monto_apertura, monto_esperado_efectivo, monto_real_efectivo, diferencia_efectivo, estado)
         VALUES (?, ?, ?, 0, 1000, 1000, 0, 'CERRADA')`,
        [cerrado, ids.tenantId, ids.usuarioAdminId]
      );
      await new CierreCajaService(nubeA, sq).corregirCierre(ids.tenantId, cerrado, ids.usuarioAdminId, 900, 'migra antes');
      expect(migrar).toHaveBeenCalledTimes(1);

      sq.execute(
        `INSERT INTO cierres_caja (id, tenant_id, usuario_id, fecha_apertura, monto_apertura, monto_esperado_efectivo, estado)
         VALUES (?, ?, ?, datetime('now', '-1 hour'), 0, 0, 'ABIERTA')`,
        [createFixtureIds().ventaId, ids.tenantId, ids.usuarioAdminId]
      );
      await new CierreCajaService(nubeB, sq).cerrarCaja(ids.tenantId, ids.usuarioAdminId, 0);
      expect(migrar).toHaveBeenCalledTimes(2);
    } finally {
      migrar.mockRestore();
      await nubeA.close();
      await nubeB.close();
    }
  });

  test('el cierre lleva a la nube lo devuelto por transferencia', async () => {
    const id = createFixtureIds().ventaId;
    await cierreEnLosDos(id, 'ABIERTA', "datetime('now', '-1 hour')");
    sq.execute(
      `INSERT INTO transacciones_venta (id, tenant_id, usuario_id, folio_local_sqlite, total, unidades, estado, metodo_pago_id, es_devolucion, medio_devolucion, fecha)
       VALUES (?, ?, ?, 'DEV-TRANSFERENCIA', -1500, 1, 'COMPLETADA', ?, 1, 'TRANSFERENCIA', datetime('now'))`,
      [createFixtureIds().ventaId, ids.tenantId, ids.usuarioAdminId, ids.metodoPagoId]
    );

    await servicio.cerrarCaja(ids.tenantId, ids.usuarioAdminId, 20000);

    const [cierre] = await enLaNube('SELECT devoluciones_transferencia, estado FROM cierres_caja WHERE id = $1', [id]);
    expect([Number(cierre.devoluciones_transferencia), cierre.estado]).toEqual([1500, 'CERRADA']);
  });
});

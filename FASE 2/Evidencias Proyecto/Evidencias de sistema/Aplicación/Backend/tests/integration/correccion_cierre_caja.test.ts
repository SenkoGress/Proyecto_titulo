import http from 'http';
import app from '../../src/index';
import { initializeDatabase } from '../../src/database/init-db';
import { defaultSqliteClient } from '../../src/database/sqlite/client';

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
  });
});

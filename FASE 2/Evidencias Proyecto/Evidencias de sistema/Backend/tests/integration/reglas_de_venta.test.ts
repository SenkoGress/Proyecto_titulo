import http from 'http';
import app from '../../src/index';
import { initializeDatabase } from '../../src/database/init-db';
import { defaultSqliteClient } from '../../src/database/sqlite/client';
import { defaultPaymentDispatcher } from '../../src/payments/payment-dispatcher.service';

/**
 * Las tres reglas que la caja no puede saltarse: no vende con el turno cerrado, no vende mas de lo
 * que hay, y no deja un cobro con tarjeta sin su venta.
 */
describe('Reglas de la venta en la caja', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const usuarioId = '00000000-0000-0000-0000-000000000002';
  const productoId = 'aaaaaaaa-0000-4000-8000-0000000reg01';
  let servidor: http.Server;
  let base: string;

  const pedir = async (ruta: string, cuerpo: unknown) => {
    const res = await fetch(`${base}/api/v1${ruta}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
    });
    return { status: res.status, json: (await res.json()) as any };
  };
  const vender = (cantidad: number, metodo = 'EFECTIVO') =>
    pedir('/pos/checkout', { tenant_id: tenantId, usuario_id: usuarioId, metodo_pago: metodo, items: [{ producto_id: productoId, cantidad }] });
  const stock = () => defaultSqliteClient.queryOne<{ s: number }>('SELECT stock_actual AS s FROM productos WHERE id = ?', [productoId])!.s;
  const ventas = () => defaultSqliteClient.queryOne<{ n: number }>('SELECT COUNT(*) AS n FROM transacciones_venta')!.n;

  beforeAll(async () => {
    await initializeDatabase();
    defaultSqliteClient.execute(
      `INSERT OR IGNORE INTO productos (id, tenant_id, sku, nombre, stock_actual, stock_minimo, precio_compra, precio_venta, activo)
       VALUES (?, ?, 'REGLAS-1', 'Leche para las reglas', 2, 1, 500, 1000, 1)`,
      [productoId, tenantId]
    );
    defaultSqliteClient.execute("UPDATE cierres_caja SET estado = 'CERRADA' WHERE tenant_id = ?", [tenantId]);
    await new Promise<void>((listo) => {
      servidor = app.listen(0, () => {
        base = `http://127.0.0.1:${(servidor.address() as any).port}`;
        listo();
      });
    });
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    await new Promise((listo) => servidor.close(listo));
  });

  test('con la caja cerrada no se vende, y la respuesta trae un codigo estable', async () => {
    const res = await vender(1);
    expect(res.status).toBe(400);
    expect(res.json.error).toBe('TURNO_CERRADO');
    expect(stock()).toBe(2);
  });

  test('con la caja abierta no se vende mas de lo que hay, y se dice cuanto queda', async () => {
    const abrir = await pedir('/caja/abrir', { tenant_id: tenantId, usuario_id: usuarioId, monto_apertura: 20000 });
    expect(abrir.status).toBe(201);

    const res = await vender(3);
    expect(res.status).toBe(409);
    expect(res.json.error).toBe('STOCK_INSUFICIENTE');
    expect(res.json.productos).toEqual([{ producto_id: productoId, nombre: 'Leche para las reglas', disponible: 2, pedida: 3 }]);
    expect(res.json.message).toContain('quedan 2, se piden 3');
    expect(stock()).toBe(2);

    // dos lineas del mismo producto se suman antes de comparar con el stock
    const partida = await pedir('/pos/checkout', {
      tenant_id: tenantId, usuario_id: usuarioId, metodo_pago: 'EFECTIVO',
      items: [{ producto_id: productoId, cantidad: 2 }, { producto_id: productoId, cantidad: 1 }],
    });
    expect(partida.status).toBe(409);
  });

  test('la venta por el stock justo pasa, con su boleta y su folio marcado como provisional', async () => {
    const res = await vender(1);
    expect(res.status).toBe(201);
    expect(res.json.data.dte.folio).toBeGreaterThan(0);
    expect(res.json.data.dte.folio_provisional).toBe(true);
    expect(stock()).toBe(1);
  });

  test('si la tarjeta se cobro y la venta no se guarda, el cobro se devuelve y no queda venta', async () => {
    const antes = ventas();
    const cobro = {
      transactionId: 'pago-1', saleId: 'x', gateway: 'MercadoPago' as const, token: 'ORD1', amount: 1000,
      status: 'APPROVED' as const, metadataResponse: {}, usedFallback: false, createdAt: new Date().toISOString(),
    };
    jest.spyOn(defaultPaymentDispatcher, 'cobrar').mockResolvedValueOnce(cobro);
    const devolver = jest.spyOn(defaultPaymentDispatcher, 'devolverCobro').mockResolvedValueOnce({ devuelto: true, detalle: '' });
    jest.spyOn(defaultSqliteClient, 'withTransaction').mockImplementationOnce(() => {
      throw new Error('disco lleno');
    });

    const res = await vender(1, 'MERCADOPAGO');

    expect(res.status).toBe(500);
    expect(res.json).toMatchObject({ error: 'COBRO_DEVUELTO', cobro_devuelto: true });
    expect(devolver).toHaveBeenCalledWith(cobro, expect.any(String));
    expect(ventas()).toBe(antes);
    expect(stock()).toBe(1);
  });

  test('si el cobro no se pudo devolver, la respuesta dice que no se cobre de nuevo', async () => {
    const cobro = {
      transactionId: 'pago-2', saleId: 'x', gateway: 'Transbank' as const, token: 'T1', amount: 1000,
      status: 'APPROVED' as const, metadataResponse: {}, usedFallback: false, createdAt: new Date().toISOString(),
    };
    jest.spyOn(defaultPaymentDispatcher, 'cobrar').mockResolvedValueOnce(cobro);
    jest.spyOn(defaultPaymentDispatcher, 'devolverCobro').mockResolvedValueOnce({ devuelto: false, detalle: 'terminal sin respuesta' });
    jest.spyOn(defaultSqliteClient, 'withTransaction').mockImplementationOnce(() => {
      throw new Error('disco lleno');
    });

    const res = await vender(1, 'TRANSBANK');

    expect(res.json).toMatchObject({ error: 'COBRO_SIN_VENTA', cobro_devuelto: false });
    expect(res.json.message).toContain('NO cobres de nuevo');
  });
});

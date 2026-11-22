import http from 'http';

/**
 * Una venta y su devolucion de punta a punta con el SDK oficial de Transbank (transbank-pos-sdk).
 * Transbank no ofrece un ambiente de pruebas para el POS Integrado, asi que el puerto serie se
 * reemplaza por el simulado de la propia libreria serialport, y del otro lado responde un terminal
 * que habla el protocolo del POS Integrado: tramas STX + mensaje + ETX + LRC, ACK al recibir y
 * respuesta separada por campos con "|". Todo lo demas (el SDK, la pasarela, el checkout, la
 * devolucion) es el codigo que corre con una maquina real.
 */
jest.mock('serialport', () => {
  const real = jest.requireActual('serialport');
  return { ...real, SerialPort: real.SerialPortMock };
});

import { MockBinding, MockPortBinding } from '@serialport/binding-mock';
import app from '../../src/index';
import { tipoTarjetaDePasarela } from '../../src/routes/pos.routes';
import { initializeDatabase } from '../../src/database/init-db';
import { defaultSqliteClient } from '../../src/database/sqlite/client';

const STX = 0x02;
const ETX = 0x03;
const ACK = 0x06;

function trama(mensaje: string): Buffer {
  const cuerpo = Buffer.from(mensaje + String.fromCharCode(ETX), 'latin1');
  const lrc = cuerpo.reduce((x, b) => x ^ b, 0);
  return Buffer.concat([Buffer.from([STX]), cuerpo, Buffer.from([lrc])]);
}

/** Terminal POS Integrado: guarda lo que recibe y responde segun el codigo de funcion. */
const terminal = {
  recibidos: [] as string[],
  codigoVenta: '00',
  operacion: 4127,
  responder(binding: MockPortBinding, datos: Buffer) {
    if (datos.length === 1 && datos[0] === ACK) return; // el SDK confirma nuestra respuesta
    const mensaje = datos.subarray(1, datos.indexOf(ETX)).toString('latin1');
    terminal.recibidos.push(mensaje);
    const campos = mensaje.split('|');
    setTimeout(() => binding.emitData(Buffer.from([ACK])), 10);

    let respuesta: string | null = null;
    if (campos[0] === '0200') {
      // 0200|monto|ticket|... -> 0210|codigo|comercio|terminal|ticket|autorizacion|monto|cuotas|
      // monto cuota|ultimos4|operacion|tipo|fecha contable|cuenta|marca|fecha|hora|empleado|propina
      const monto = String(Number(campos[1]));
      terminal.operacion += 1;
      respuesta = ['0210', terminal.codigoVenta, '597029414300', 'TBK00042', campos[2],
        terminal.codigoVenta === '00' ? '583201' : '', monto, '0', '0', '6623', String(terminal.operacion),
        'CR', '1511', '', 'VI', '15112026', '183000', '0', '0'].join('|');
    } else if (campos[0] === '1200') {
      // 1200|operacion| -> 1210|codigo|comercio|terminal|autorizacion|operacion
      respuesta = ['1210', '00', '597029414300', 'TBK00042', '991204', campos[1]].join('|');
    }
    // Separada del ACK por mas de 100 ms, que es lo que el SDK espera entre una trama y otra
    if (respuesta) setTimeout(() => binding.emitData(trama(respuesta!)), 300);
  },
};

const escribirOriginal = MockPortBinding.prototype.write;

describe('Venta con tarjeta por el SDK oficial de Transbank POS Integrado', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const usuarioId = '00000000-0000-0000-0000-000000000002';
  const productoId = 'aaaaaaaa-0000-4000-8000-00000000tbk1';
  const entorno = { ...process.env };
  let servidor: http.Server;
  let base: string;

  beforeAll(async () => {
    MockPortBinding.prototype.write = async function (this: MockPortBinding, datos: Buffer) {
      await escribirOriginal.call(this, datos);
      terminal.responder(this, Buffer.from(datos));
    };
    MockBinding.createPort('COM9', { echo: false, record: false });
    Object.assign(process.env, { PAGOS_MODO: 'produccion', TBK_POS_PUERTO: 'COM9' });

    await initializeDatabase();
    defaultSqliteClient.execute(
      `INSERT OR IGNORE INTO productos (id, tenant_id, sku, nombre, stock_actual, stock_minimo, precio_compra, precio_venta, activo)
       VALUES (?, ?, 'TBK-SDK-1', 'Galletas para la prueba del terminal', 20, 1, 500, 1890, 1)`,
      [productoId, tenantId]
    );
    await new Promise<void>((listo) => {
      servidor = app.listen(0, () => {
        base = `http://127.0.0.1:${(servidor.address() as any).port}`;
        listo();
      });
    });
    // La venta exige un turno abierto
    await fetch(`${base}/api/v1/caja/abrir`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: tenantId, usuario_id: usuarioId, monto_apertura: 20000 }),
    });
  });

  afterAll(async () => {
    MockPortBinding.prototype.write = escribirOriginal;
    MockBinding.reset();
    process.env = entorno;
    await new Promise((listo) => servidor.close(listo));
  });

  const stock = () => defaultSqliteClient.queryOne<{ s: number }>('SELECT stock_actual AS s FROM productos WHERE id = ?', [productoId])!.s;
  const cobrar = () => fetch(`${base}/api/v1/pos/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenant_id: tenantId, usuario_id: usuarioId, metodo_pago: 'TRANSBANK', items: [{ producto_id: productoId, cantidad: 1 }] }),
  });

  test('la venta aprobada en el terminal queda pagada, con boleta y con el numero de operacion', async () => {
    terminal.codigoVenta = '00';
    const antes = stock();

    const res = await cobrar();
    const json: any = await res.json();

    expect(res.status).toBe(201);
    // El SDK abrio el puerto con un sondeo y mando la venta con el monto en 9 digitos
    expect(terminal.recibidos[0]).toBe('0100');
    expect(terminal.recibidos[1]).toMatch(/^0200\|000001890\|[0-9A-F]{6}\|/);
    expect(json.data.dte.tipoDocumento).toBe('BOLETA_ELECTRONICA');
    expect(stock()).toBe(antes - 1);

    const pago = defaultSqliteClient.queryOne<any>('SELECT * FROM payment_transactions WHERE sale_id = ?', [json.data.venta_id ?? json.data.id ?? json.data.saleId]);
    expect(pago.estado_transaccion).toBe('APPROVED');
    const meta = JSON.parse(pago.metadata_response);
    expect(meta).toMatchObject({ response_code: 0, response_message: 'Aprobado', card_last4: '6623', operation_number: String(terminal.operacion) });

    // La devolucion anula la venta en el terminal con su numero de operacion antes de la nota de credito
    const dev = await fetch(`${base}/api/v1/pos/devolucion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: tenantId, usuario_id: usuarioId, venta_id: pago.sale_id }),
    });
    const devJson: any = await dev.json();
    expect(dev.status).toBe(200);
    expect(terminal.recibidos[terminal.recibidos.length - 1]).toBe(`1200|${terminal.operacion}|`);
    expect(devJson.data.reverso_tarjeta).toMatchObject({ pasarela: 'Transbank', monto: 1890 });
    expect(stock()).toBe(antes);
  });

  test('la venta rechazada en el terminal no deja venta ni descuenta stock', async () => {
    terminal.codigoVenta = '01';
    const antes = stock();
    const ventas = defaultSqliteClient.queryOne<{ n: number }>('SELECT COUNT(*) AS n FROM transacciones_venta')!.n;

    const res = await cobrar();
    const json: any = await res.json();

    expect(res.status).toBe(402);
    expect(json.message).toContain('Rechazado');
    expect(stock()).toBe(antes);
    expect(defaultSqliteClient.queryOne<{ n: number }>('SELECT COUNT(*) AS n FROM transacciones_venta')!.n).toBe(ventas);
  });

  test('una devolucion parcial con Transbank emite la nota de credito y deja el reverso como manual', async () => {
    terminal.codigoVenta = '00';
    const res = await fetch(`${base}/api/v1/pos/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: tenantId, usuario_id: usuarioId, metodo_pago: 'TRANSBANK', items: [{ producto_id: productoId, cantidad: 2 }] }),
    });
    const venta: any = await res.json();
    expect(res.status).toBe(201);
    const antes = stock();
    const anulacionesAntes = terminal.recibidos.filter((m) => m.startsWith('1200')).length;

    const dev = await fetch(`${base}/api/v1/pos/devolucion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: tenantId, usuario_id: usuarioId, venta_id: venta.data.saleId, items_devolucion: [{ producto_id: productoId, cantidad: 1 }] }),
    });
    const json: any = await dev.json();

    expect(dev.status).toBe(200);
    expect(json.data.folio_nc).toBeGreaterThan(0);
    expect(json.data.reverso_tarjeta).toMatchObject({ pasarela: 'Transbank', monto: 1890, manual: true });
    expect(json.message).toContain('portal de Transbank');
    expect(stock()).toBe(antes + 1);
    // El terminal no recibio ninguna anulacion: no se le puede pedir una parcial
    expect(terminal.recibidos.filter((m) => m.startsWith('1200')).length).toBe(anulacionesAntes);
    const reverso = defaultSqliteClient.queryOne<any>(
      'SELECT estado_transaccion, monto FROM payment_transactions WHERE sale_id = ?', [json.data.devolucion_id]);
    expect(reverso).toMatchObject({ estado_transaccion: 'PENDING', monto: -1890 });
  });

  test('una venta con RutPay se devuelve con su nota de credito aunque RutPay no reverse desde la caja', async () => {
    // RutPay solo cobra en modo simulado; la devolucion se hace despues, ya en produccion
    process.env.PAGOS_MODO = 'simulado';
    const res = await fetch(`${base}/api/v1/pos/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: tenantId, usuario_id: usuarioId, metodo_pago: 'RUTPAY', items: [{ producto_id: productoId, cantidad: 1 }] }),
    });
    const venta: any = await res.json();
    expect(res.status).toBe(201);
    process.env.PAGOS_MODO = 'produccion';

    const dev = await fetch(`${base}/api/v1/pos/devolucion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: tenantId, usuario_id: usuarioId, venta_id: venta.data.saleId }),
    });
    const json: any = await dev.json();

    expect(dev.status).toBe(200);
    expect(json.data.folio_nc).toBeGreaterThan(0);
    expect(json.data.reverso_tarjeta).toMatchObject({ pasarela: 'RutPay', manual: true });
    expect(json.message).toContain('efectivo o por transferencia');
  });

  describe('credito o debito, y como se devolvio el dinero', () => {
    const otroProducto = 'aaaaaaaa-0000-4000-8000-00000000tbk2';
    const post = async (ruta: string, cuerpo: Record<string, unknown>) => {
      const res = await fetch(`${base}/api/v1${ruta}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenant_id: tenantId, usuario_id: usuarioId, ...cuerpo }),
      });
      return { status: res.status, json: (await res.json()) as any };
    };
    const vender = (cantidad: number, extra: Record<string, unknown> = {}) =>
      post('/pos/checkout', { metodo_pago: 'TRANSBANK', items: [{ producto_id: otroProducto, cantidad }], ...extra });
    const devolver = (ventaId: string, extra: Record<string, unknown> = {}) => post('/pos/devolucion', { venta_id: ventaId, ...extra });
    const resumen = async () => ((await (await fetch(`${base}/api/v1/caja/resumen?tenant_id=${tenantId}`)).json()) as any).data;
    const venta = (id: string) => defaultSqliteClient.queryOne<any>('SELECT * FROM transacciones_venta WHERE id = ?', [id]);
    const devolucionesDe = (id: string) =>
      Number(defaultSqliteClient.queryOne<{ n: number }>('SELECT COUNT(*) AS n FROM transacciones_venta WHERE referencia_venta_id = ?', [id])!.n);
    const stockOtro = () => defaultSqliteClient.queryOne<{ s: number }>('SELECT stock_actual AS s FROM productos WHERE id = ?', [otroProducto])!.s;

    beforeAll(() => {
      // 1.893: el efectivo que sale de la gaveta se redondea a 1.890 y la nota de credito queda exacta
      defaultSqliteClient.execute(
        `INSERT OR IGNORE INTO productos (id, tenant_id, sku, nombre, stock_actual, stock_minimo, precio_compra, precio_venta, activo)
         VALUES (?, ?, 'TBK-SDK-2', 'Queso para la prueba de la devolucion', 40, 1, 500, 1893, 1)`,
        [otroProducto, tenantId]
      );
      process.env.PAGOS_MODO = 'produccion';
      terminal.codigoVenta = '00';
    });

    test('manda el tipo de tarjeta que informa el terminal, y el historial lo muestra', async () => {
      // el terminal de la prueba responde CR (credito) aunque el cajero diga debito
      const res = await vender(1, { tipo_tarjeta: 'debito' });
      expect(res.status).toBe(201);
      expect(venta(res.json.data.saleId).tipo_tarjeta).toBe('CREDITO');

      const historial: any = await (await fetch(`${base}/api/v1/pos/transactions?tenant_id=${tenantId}`)).json();
      const fila = (historial.data ?? historial).find((v: any) => v.id === res.json.data.saleId);
      expect(fila.tipo_tarjeta).toBe('CREDITO');

      expect((await vender(1, { tipo_tarjeta: 'PREPAGO' })).status).toBe(400);
    });

    test('cada pasarela informa el tipo a su manera; SumUp solo da la marca y RutPay no es tarjeta', async () => {
      expect(tipoTarjetaDePasarela({ card_type: 'DB' })).toBe('DEBITO');
      expect(tipoTarjetaDePasarela({ card_type: 'debit_card' })).toBe('DEBITO');
      expect(tipoTarjetaDePasarela({ card_type: 'credit_card' })).toBe('CREDITO');
      expect(tipoTarjetaDePasarela({ card_type: 'MASTERCARD' })).toBeNull();

      // RutPay cobra solo en modo simulado: no lleva tipo de tarjeta aunque el cajero lo envie
      process.env.PAGOS_MODO = 'simulado';
      try {
        const rutpay = await post('/pos/checkout', { metodo_pago: 'RUTPAY', tipo_tarjeta: 'DEBITO', items: [{ producto_id: otroProducto, cantidad: 1 }] });
        expect(rutpay.status).toBe(201);
        expect(venta(rutpay.json.data.saleId).tipo_tarjeta).toBeNull();
        const efectivo = await post('/pos/checkout', { metodo_pago: 'EFECTIVO', tipo_tarjeta: 'CREDITO', items: [{ producto_id: otroProducto, cantidad: 1 }] });
        expect(venta(efectivo.json.data.saleId).tipo_tarjeta).toBeNull();
        // en modo simulado Transbank no informa el tipo: vale el del cajero
        const simulada = await vender(1, { tipo_tarjeta: 'DEBITO' });
        expect(venta(simulada.json.data.saleId).tipo_tarjeta).toBe('DEBITO');
      } finally {
        process.env.PAGOS_MODO = 'produccion';
      }
    });

    test('una devolucion de antes de la 1.0.6, sin medio, se clasifica como antes', async () => {
      const v = await vender(1);
      const id = v.json.data.saleId;
      const antes = await resumen();
      // como la dejaba la version anterior: hereda el medio de la venta y no dice como se devolvio
      defaultSqliteClient.execute(
        `INSERT INTO transacciones_venta (id, tenant_id, usuario_id, folio_local_sqlite, total, unidades, estado, metodo_pago_id, es_devolucion, referencia_venta_id, fecha)
         SELECT 'dev-antigua-' || id, tenant_id, usuario_id, 'DEV-ANTIGUA', -total, unidades, 'COMPLETADA', metodo_pago_id, 1, id, datetime('now')
         FROM transacciones_venta WHERE id = ?`,
        [id]
      );
      const despues = await resumen();
      expect(despues.ventas_transbank).toBe(antes.ventas_transbank - 1893);
      expect(despues.monto_esperado_efectivo).toBe(antes.monto_esperado_efectivo);
      expect(despues.devoluciones_transferencia).toBe(antes.devoluciones_transferencia);
    });

    test('con TARJETA y un reverso imposible responde 409 sin registrar nada; en efectivo resta de la gaveta, redondeado', async () => {
      const v = await vender(2);
      const id = v.json.data.saleId;
      const stock0 = stockOtro();

      const conTarjeta = await devolver(id, { medio_devolucion: 'TARJETA', items_devolucion: [{ producto_id: otroProducto, cantidad: 1 }] });
      expect([conTarjeta.status, conTarjeta.json.error]).toEqual([409, 'REVERSO_MANUAL']);
      expect(conTarjeta.json.message).toContain('portal de Transbank');
      expect(devolucionesDe(id)).toBe(0);
      expect(stockOtro()).toBe(stock0);

      const antes = await resumen();
      const enEfectivo = await devolver(id, { medio_devolucion: 'efectivo', items_devolucion: [{ producto_id: otroProducto, cantidad: 1 }] });
      expect(enEfectivo.status).toBe(200);
      expect(enEfectivo.json.data).toMatchObject({ medio_devolucion: 'EFECTIVO', total_devuelto: 1893, devuelto_al_cliente: 1890 });
      const nc = defaultSqliteClient.queryOne<{ monto_total: number }>(
        'SELECT monto_total FROM sii_dte_emitidos WHERE venta_id = ?', [enEfectivo.json.data.devolucion_id]);
      expect(Number(nc?.monto_total)).toBe(1893);
      const despues = await resumen();
      expect(despues.monto_esperado_efectivo).toBe(antes.monto_esperado_efectivo - 1890);
      expect(despues.ventas_transbank).toBe(antes.ventas_transbank);

      // el resto con TARJETA: Transbank no anula una parte, 409; la gaveta resta solo la primera
      const resto = await devolver(id, { medio_devolucion: 'TARJETA' });
      expect(resto.status).toBe(409);
      expect((await resumen()).monto_esperado_efectivo).toBe(antes.monto_esperado_efectivo - 1890);

      // por transferencia no sale de la gaveta ni de la tarjeta, y el total sigue cuadrando con el desglose
      const porTransferencia = await devolver(id, { medio_devolucion: 'TRANSFERENCIA' });
      expect(porTransferencia.status).toBe(200);
      const fin = await resumen();
      expect(fin.monto_esperado_efectivo).toBe(despues.monto_esperado_efectivo);
      expect(fin.ventas_transbank).toBe(despues.ventas_transbank);
      expect(fin.devoluciones_transferencia).toBe((despues.devoluciones_transferencia ?? 0) + 1893);
      expect(fin.total_ventas).toBe(
        fin.ventas_efectivo + fin.ventas_transbank + fin.ventas_mercadopago + fin.ventas_sumup + fin.ventas_rutpay - fin.devoluciones_transferencia
      );
      expect(venta(porTransferencia.json.data.devolucion_id).medio_devolucion).toBe('TRANSFERENCIA');
    });

    test('una venta con tarjeta sin pago aprobado no se da por devuelta en la maquina', async () => {
      const v = await vender(1);
      const id = v.json.data.saleId;
      defaultSqliteClient.execute('DELETE FROM payment_transactions WHERE sale_id = ?', [id]);

      const res = await devolver(id, { medio_devolucion: 'TARJETA' });
      expect([res.status, res.json.error]).toEqual([409, 'REVERSO_MANUAL']);
      expect(devolucionesDe(id)).toBe(0);
    });

    test('medios invalidos y la caja cerrada se rechazan antes de devolver nada', async () => {
      const enEfectivo = await post('/pos/checkout', { metodo_pago: 'EFECTIVO', items: [{ producto_id: otroProducto, cantidad: 1 }] });
      const id = enEfectivo.json.data.saleId;
      expect((await devolver(id, { medio_devolucion: 'CHEQUE' })).status).toBe(400);
      expect((await devolver(id, { medio_devolucion: 'TRANSFERENCIA' })).json.error).toBe('MEDIO_DEVOLUCION_INVALIDO');
      expect((await devolver(id, { medio_devolucion: 'TARJETA' })).status).toBe(400);

      const turno = defaultSqliteClient.queryOne<{ id: string }>("SELECT id FROM cierres_caja WHERE tenant_id = ? AND estado = 'ABIERTA'", [tenantId])!;
      defaultSqliteClient.execute("UPDATE cierres_caja SET estado = 'CERRADA' WHERE id = ?", [turno.id]);
      try {
        const cerrada = await devolver(id, { medio_devolucion: 'EFECTIVO' });
        expect([cerrada.status, cerrada.json.error]).toEqual([400, 'TURNO_CERRADO']);
      } finally {
        defaultSqliteClient.execute("UPDATE cierres_caja SET estado = 'ABIERTA' WHERE id = ?", [turno.id]);
      }
      expect(devolucionesDe(id)).toBe(0);

      // sin medio, la venta en efectivo se devuelve como siempre y queda dicho que fue en efectivo
      const normal = await devolver(id);
      expect(normal.status).toBe(200);
      expect(normal.json.data.medio_devolucion).toBe('EFECTIVO');
    });

    test('dos devoluciones de la misma venta a la vez: una se registra y la otra espera su turno', async () => {
      const v = await vender(1);
      const [a, b] = await Promise.all([devolver(v.json.data.saleId), devolver(v.json.data.saleId)]);

      expect([a.status, b.status].sort()).toEqual([200, 409]);
      expect([a.json.error, b.json.error]).toContain('DEVOLUCION_EN_CURSO');
      expect(devolucionesDe(v.json.data.saleId)).toBe(1);
    });

    // va al final: cierra el turno de esta prueba
    test('el panel y el cierre muestran lo devuelto por transferencia en su propio rubro', async () => {
      const transferido = Number(defaultSqliteClient.queryOne<{ t: number }>(
        "SELECT COALESCE(SUM(-total), 0) AS t FROM transacciones_venta WHERE tenant_id = ? AND medio_devolucion = 'TRANSFERENCIA'", [tenantId])!.t);
      expect(transferido).toBeGreaterThan(0);

      const panel: any = await (await fetch(`${base}/api/v1/dashboard/overview?tenant_id=${tenantId}&periodo=historico`)).json();
      const rubro = panel.data.paymentsBreakdown.find((p: any) => p.metodo === 'TRANSFERENCIA');
      expect(rubro.total).toBe(-transferido);

      const esperado = (await resumen()).devoluciones_transferencia;
      const cerrado = await post('/caja/cerrar', { monto_real_efectivo: 0 });
      expect(cerrado.status).toBe(200);
      const guardado = defaultSqliteClient.queryOne<{ d: number }>('SELECT devoluciones_transferencia AS d FROM cierres_caja WHERE id = ?', [cerrado.json.data.id])!;
      expect(Number(guardado.d)).toBe(esperado);
    });
  });
});

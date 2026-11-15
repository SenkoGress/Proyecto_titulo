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
});

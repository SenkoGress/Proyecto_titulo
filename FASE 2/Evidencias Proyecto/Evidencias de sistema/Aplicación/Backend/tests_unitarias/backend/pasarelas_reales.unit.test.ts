import { configPagos } from '../../backend/src/payments/pagos.config';
import { MercadoPagoGateway } from '../../backend/src/payments/mercadopago.gateway';
import { SumUpGateway } from '../../backend/src/payments/sumup.gateway';
import { MaquinaPos, RespuestaVentaPos, TransbankGateway } from '../../backend/src/payments/transbank.gateway';
import { PaymentDispatcherService } from '../../backend/src/payments/payment-dispatcher.service';
import { IPaymentGateway } from '../../backend/src/payments/payment-gateway.interface';
import { PaymentGatewayType, ReversoManual } from '../../backend/src/payments/types';

/**
 * Las conexiones reales con las maquinas de pago, con el proveedor reemplazado por respuestas
 * armadas segun su documentacion: no sale ninguna peticion a internet.
 */
type Llamada = { url: string; metodo: string; cabeceras: Record<string, string>; cuerpo: any };

function proveedorFalso(respuestas: Array<{ status?: number; body?: unknown }>) {
  const llamadas: Llamada[] = [];
  const http = (async (url: string, init: any) => {
    llamadas.push({ url, metodo: init.method, cabeceras: init.headers, cuerpo: init.body ? JSON.parse(init.body) : undefined });
    const r = respuestas.shift() ?? { status: 500, body: { message: 'sin respuesta preparada' } };
    const status = r.status ?? 200;
    return { ok: status < 400, status, text: async () => (r.body === undefined ? '' : JSON.stringify(r.body)) };
  }) as unknown as typeof fetch;
  return { http, llamadas };
}

const ENTORNO = { ...process.env };
afterEach(() => {
  process.env = { ...ENTORNO };
});
const venta = { saleId: '3f2a9c1e-0000-4000-8000-000000000001', tenantId: 't1', amount: 1890 };

describe('Configuracion de cobro', () => {
  test('sin configurar la caja queda en modo simulado', () => {
    delete process.env.PAGOS_MODO;
    expect(configPagos().modo).toBe('simulado');
  });

  test('un modo mal escrito se rechaza en vez de cobrar en uno que nadie eligio', () => {
    process.env.PAGOS_MODO = 'produccio';
    expect(() => configPagos()).toThrow(/simulado, sandbox o produccion/);
  });

  test('en sandbox Mercado Pago usa su terminal virtual si no hay uno configurado', () => {
    process.env.PAGOS_MODO = 'sandbox';
    expect(configPagos().mercadoPago.terminalId).toBe('NEWLAND_N950__SBX0000001');
  });
});

describe('Mercado Pago Point', () => {
  beforeEach(() => {
    process.env.PAGOS_MODO = 'sandbox';
    process.env.MP_ACCESS_TOKEN = 'APP_USR-prueba';
    process.env.MP_SANDBOX_RESULTADO = 'processed';
  });

  test('envia la orden al terminal, pide el resultado al sandbox y la lee aprobada', async () => {
    const { http, llamadas } = proveedorFalso([
      { status: 201, body: { id: 'ORD01', status: 'created' } },
      { status: 204 },
      { body: { id: 'ORD01', status: 'processed', transactions: { payments: [{ id: 'PAY01', amount: '1890', reference_id: '0099' }] } } },
    ]);
    const mp = new MercadoPagoGateway(http);

    const inicio = await mp.initiatePayment({ ...venta, gateway: 'MercadoPago' });
    const fin = await mp.confirmPayment({ token: inicio.token, saleId: venta.saleId, tenantId: 't1', gateway: 'MercadoPago' });

    expect(llamadas[0].url).toBe('https://api.mercadopago.com/v1/orders');
    expect(llamadas[0].cabeceras['X-Idempotency-Key']).toBe(venta.saleId);
    expect(llamadas[0].cabeceras.Authorization).toBe('Bearer APP_USR-prueba');
    expect(llamadas[0].cuerpo).toMatchObject({
      type: 'point',
      external_reference: venta.saleId,
      transactions: { payments: [{ amount: '1890' }] },
      config: { point: { terminal_id: 'NEWLAND_N950__SBX0000001' } },
    });
    expect(llamadas[1]).toMatchObject({ url: 'https://api.mercadopago.com/v1/orders/ORD01/events', cuerpo: { status: 'processed' } });
    expect(fin).toMatchObject({ status: 'APPROVED', transactionId: 'PAY01', amount: 1890, authorizationCode: '0099' });
  });

  test('una orden fallida queda rechazada', async () => {
    const { http } = proveedorFalso([{ body: { id: 'ORD02', status: 'failed', status_detail: 'rejected_by_issuer' } }]);
    const fin = await new MercadoPagoGateway(http).confirmPayment({ token: 'ORD02', saleId: venta.saleId, tenantId: 't1', gateway: 'MercadoPago' });
    expect(fin.status).toBe('REJECTED');
    expect(fin.metadataResponse.status_detail).toBe('rejected_by_issuer');
  });

  test('sin Access Token no llama a Mercado Pago y dice que falta', async () => {
    delete process.env.MP_ACCESS_TOKEN;
    const { http, llamadas } = proveedorFalso([]);
    await expect(new MercadoPagoGateway(http).initiatePayment({ ...venta, gateway: 'MercadoPago' })).rejects.toThrow(/MP_ACCESS_TOKEN/);
    expect(llamadas).toHaveLength(0);
  });
});

describe('SumUp Cloud API', () => {
  beforeEach(() => {
    Object.assign(process.env, {
      PAGOS_MODO: 'produccion',
      SUMUP_API_KEY: 'sup_sk_prueba',
      SUMUP_MERCHANT_CODE: 'MC123',
      SUMUP_READER_ID: 'rdr_1',
      SUMUP_AFFILIATE_KEY: 'sup_afk_1',
      SUMUP_APP_ID: 'cl.gestock',
    });
  });

  test('cobra en pesos sin decimales y espera a que la transaccion exista', async () => {
    const { http, llamadas } = proveedorFalso([
      { status: 201, body: { data: { client_transaction_id: 'CTX-1' } } },
      { status: 404, body: { message: 'Not found' } },
      { body: { id: 'tx1', status: 'SUCCESSFUL', amount: 1890, transaction_code: 'TQ42', card: { type: 'VISA', last_4_digits: '1234' } } },
    ]);
    const sumup = new SumUpGateway(http);

    const inicio = await sumup.initiatePayment({ ...venta, gateway: 'SumUp' });
    const fin = await sumup.confirmPayment({ token: inicio.token, saleId: venta.saleId, tenantId: 't1', gateway: 'SumUp' });

    expect(llamadas[0].url).toBe('https://api.sumup.com/v0.1/merchants/MC123/readers/rdr_1/checkout');
    expect(llamadas[0].cuerpo.total_amount).toEqual({ currency: 'CLP', minor_unit: 0, value: 1890 });
    expect(llamadas[0].cuerpo.affiliate).toEqual({ app_id: 'cl.gestock', key: 'sup_afk_1', foreign_transaction_id: venta.saleId });
    expect(llamadas[1].url).toBe('https://api.sumup.com/v2.1/merchants/MC123/transactions?client_transaction_id=CTX-1');
    expect(fin).toMatchObject({ status: 'APPROVED', authorizationCode: 'TQ42' });
    expect(fin.metadataResponse.card_last4).toBe('1234');
  });

  test('una transaccion fallida queda rechazada', async () => {
    const { http } = proveedorFalso([{ body: { id: 'tx2', status: 'FAILED' } }]);
    const fin = await new SumUpGateway(http).confirmPayment({ token: 'CTX-2', saleId: venta.saleId, tenantId: 't1', gateway: 'SumUp' });
    expect(fin.status).toBe('REJECTED');
  });

  test('si nadie paga a tiempo, retira el cobro del lector y lo da por rechazado', async () => {
    process.env.PAGOS_ESPERA_MAXIMA_MS = '1';
    const { http, llamadas } = proveedorFalso([
      { status: 404, body: { message: 'Not found' } },
      { status: 202 },
      { status: 404, body: { message: 'Not found' } },
    ]);
    const fin = await new SumUpGateway(http).confirmPayment({ token: 'CTX-3', saleId: venta.saleId, tenantId: 't1', gateway: 'SumUp' });
    expect(llamadas[1]).toMatchObject({ metodo: 'POST', url: 'https://api.sumup.com/v0.1/merchants/MC123/readers/rdr_1/terminate' });
    expect(fin.status).toBe('REJECTED');
    expect(fin.metadataResponse.status).toBe('SIN_RESPUESTA');
  }, 10000);
});

describe('Transbank POS Integrado', () => {
  function maquina(respuestas: Array<RespuestaVentaPos | Error>) {
    const m = {
      conexiones: 0,
      ventas: [] as Array<[number, string]>,
      connect: async () => {
        m.conexiones++;
      },
      autoconnect: async () => {
        m.conexiones++;
      },
      anulaciones: [] as string[],
      refund: async (operacion: string) => {
        m.anulaciones.push(operacion);
        return { responseCode: 0, authorizationCode: '991204' };
      },
      sale: async (monto: number, ticket: string) => {
        m.ventas.push([monto, ticket]);
        const r = respuestas.shift()!;
        if (r instanceof Error) throw r;
        return r;
      },
    };
    return m;
  }

  beforeEach(() => {
    process.env.PAGOS_MODO = 'produccion';
    process.env.TBK_POS_PUERTO = 'COM3';
  });

  test('manda el monto y un ticket de 6 caracteres, y lee la venta aprobada', async () => {
    const m = maquina([{ responseCode: 0, responseMessage: 'Aprobado', authorizationCode: '583201', amount: 1890, last4Digits: 6623, operationNumber: 41 }]);
    const tbk = new TransbankGateway(m as MaquinaPos);

    const inicio = await tbk.initiatePayment({ ...venta, gateway: 'Transbank' });
    const fin = await tbk.confirmPayment({ token: inicio.token, saleId: venta.saleId, tenantId: 't1', gateway: 'Transbank' });

    expect(m.ventas).toEqual([[1890, '3F2A9C']]);
    expect(fin).toMatchObject({ status: 'APPROVED', authorizationCode: '583201' });
    // El numero de operacion se repite entre terminales: queda en metadata y el id es propio
    expect(fin.metadataResponse).toMatchObject({ card_last4: '6623', operation_number: '41' });
  });

  test('un codigo de respuesta distinto de 0 es un rechazo', async () => {
    const tbk = new TransbankGateway(maquina([{ responseCode: 5, responseMessage: 'Rechazado' }]) as MaquinaPos);
    const inicio = await tbk.initiatePayment({ ...venta, gateway: 'Transbank' });
    const fin = await tbk.confirmPayment({ token: inicio.token, saleId: venta.saleId, tenantId: 't1', gateway: 'Transbank' });
    expect(fin.status).toBe('REJECTED');
  });

  test('si se corta el cable, la venta falla y la siguiente vuelve a conectar', async () => {
    const m = maquina([new Error('Port is not open'), { responseCode: 0 }]);
    const tbk = new TransbankGateway(m as MaquinaPos);
    await expect(tbk.initiatePayment({ ...venta, gateway: 'Transbank' })).rejects.toThrow('Port is not open');
    await tbk.initiatePayment({ ...venta, gateway: 'Transbank' });
    expect(m.conexiones).toBe(2);
  });
});

describe('Reverso del cobro en la devolucion', () => {
  const base = { token: 'T1', transactionId: 'PAY01', metadata: {}, totalCobrado: 5000, idReverso: 'dev-1' };

  test('Mercado Pago reembolsa la orden completa sin cuerpo, y la parcial con el pago y el monto', async () => {
    process.env.PAGOS_MODO = 'produccion';
    process.env.MP_ACCESS_TOKEN = 'APP_USR-prod';
    const { http, llamadas } = proveedorFalso([{ body: { status: 'refunded' } }, { body: { status: 'processed', status_detail: 'partially_refunded' } }]);
    const mp = new MercadoPagoGateway(http);

    await mp.reembolsar({ ...base, monto: 5000 });
    await mp.reembolsar({ ...base, monto: 1890 });

    expect(llamadas[0]).toMatchObject({ url: 'https://api.mercadopago.com/v1/orders/T1/refund', cuerpo: undefined });
    expect(llamadas[0].cabeceras['X-Idempotency-Key']).toBe('dev-1');
    expect(llamadas[1].cuerpo).toEqual({ transactions: [{ id: 'PAY01', amount: '1890' }] });
  });

  test('en sandbox Mercado Pago no reembolsa pagos simulados: el reembolso se pide como evento', async () => {
    Object.assign(process.env, { PAGOS_MODO: 'sandbox', MP_ACCESS_TOKEN: 'APP_USR-prueba', MP_SANDBOX_RESULTADO: 'processed' });
    const { http, llamadas } = proveedorFalso([{ status: 204 }, { body: { id: 'T1', status: 'refunded', status_detail: 'refunded' } }]);
    const r = await new MercadoPagoGateway(http).reembolsar({ ...base, monto: 5000 });
    expect(llamadas[0]).toMatchObject({ url: 'https://api.mercadopago.com/v1/orders/T1/events', cuerpo: { status: 'refunded' } });
    expect(r).toMatchObject({ order_status: 'refunded', simulado_en_sandbox: true });
  });

  test('SumUp reembolsa el pago por su id, en pesos', async () => {
    Object.assign(process.env, { PAGOS_MODO: 'produccion', SUMUP_API_KEY: 'k', SUMUP_MERCHANT_CODE: 'MC123' });
    const { http, llamadas } = proveedorFalso([{ status: 201, body: {} }]);
    await new SumUpGateway(http).reembolsar({ ...base, transactionId: 'tx1', monto: 1890 });
    expect(llamadas[0]).toMatchObject({ url: 'https://api.sumup.com/v1.0/merchants/MC123/payments/tx1/refunds', cuerpo: { amount: 1890 } });
  });

  test('Transbank anula por numero de operacion, y una devolucion parcial se rechaza con su motivo', async () => {
    process.env.PAGOS_MODO = 'produccion';
    const m = { conexiones: 0, anulaciones: [] as string[], connect: async () => undefined, autoconnect: async () => undefined,
      sale: async () => ({ responseCode: 0 }),
      refund: async (op: string) => { m.anulaciones.push(op); return { responseCode: 0 }; } };
    const tbk = new TransbankGateway(m as MaquinaPos);

    await tbk.reembolsar({ ...base, metadata: { operation_number: '4128' }, monto: 5000 });
    await expect(tbk.reembolsar({ ...base, metadata: { operation_number: '4128' }, monto: 1890 })).rejects.toThrow(ReversoManual);
    expect(m.anulaciones).toEqual(['4128']);
  });
});

describe('Despachador fuera del modo simulado', () => {
  test('una pasarela caida no termina en un cobro aprobado por el simulador', async () => {
    process.env.PAGOS_MODO = 'produccion';
    const caida: IPaymentGateway = {
      gatewayType: 'Transbank',
      initiatePayment: async () => {
        throw new Error('terminal sin respuesta');
      },
      confirmPayment: async () => {
        throw new Error('no deberia llamarse');
      },
    };
    const despachador = new PaymentDispatcherService(undefined, new Map<PaymentGatewayType, IPaymentGateway>([['Transbank', caida]]));
    await expect(despachador.cobrar({ ...venta, gateway: 'Transbank' })).rejects.toThrow('terminal sin respuesta');
  });
});

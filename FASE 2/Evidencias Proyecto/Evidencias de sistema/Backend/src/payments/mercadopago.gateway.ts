import { v4 as uuidv4 } from 'uuid';
import { IPaymentGateway } from './payment-gateway.interface';
import {
  PaymentConfirmRequest,
  PaymentGatewayType,
  PaymentInitRequest,
  PaymentInitResponse,
  PaymentTransactionResult,
  ReembolsoRequest
} from './types';
import { logger } from '../utils/logger';
import { configPagos, esperar, exigir } from './pagos.config';

const API = 'https://api.mercadopago.com';
// Estados finales de una orden Point; processed es la unica aprobada
const FINALES = ['processed', 'failed', 'canceled', 'expired', 'refunded'];

export class MercadoPagoGateway implements IPaymentGateway {
  public gatewayType: PaymentGatewayType = 'MercadoPago';

  /** fetch inyectable para las pruebas. */
  constructor(private http: typeof fetch = fetch) {}

  public async initiatePayment(req: PaymentInitRequest): Promise<PaymentInitResponse> {
    if (configPagos().modo !== 'simulado') return this.crearOrden(req);
    if (req.simulateFailure) {
      throw new Error('MercadoPago Point API 429 Too Many Requests / Network Disconnect');
    }

    logger.info('MercadoPagoGateway', `Creating MercadoPago preference for sale ${req.saleId}`);
    const token = `mp_pref_${uuidv4().replace(/-/g, '')}`;

    return {
      token,
      paymentUrl: `https://www.mercadopago.cl/checkout/v1/redirect?pref_id=${token}`,
      gateway: this.gatewayType,
      status: 'PENDING'
    };
  }

  public async confirmPayment(req: PaymentConfirmRequest): Promise<PaymentTransactionResult> {
    if (configPagos().modo !== 'simulado') return this.esperarOrden(req);
    if (req.simulateFailure) {
      throw new Error('MercadoPago payment capture failed');
    }

    logger.info('MercadoPagoGateway', `Confirming MercadoPago payment for token ${req.token}`);

    return {
      transactionId: uuidv4(),
      saleId: req.saleId,
      gateway: this.gatewayType,
      token: req.token,
      amount: 1000,
      status: 'APPROVED',
      authorizationCode: 'MP-998877',
      metadataResponse: {
        gateway: 'MercadoPago',
        payment_method_id: 'visa',
        card_brand: 'Visa Crédito',
        card_last4: '8877',
        card_masked: '**** **** **** 8877',
        status_detail: 'accredited',
        operation_type: 'regular_payment',
        pci_dss_compliant: true
      },
      usedFallback: false,
      createdAt: new Date().toISOString()
    };
  }

  /** POST /v1/orders/{id}/refund: sin cuerpo es total; con la transaccion y el monto, parcial. */
  public async reembolsar(req: ReembolsoRequest): Promise<Record<string, unknown>> {
    if (configPagos().modo === 'simulado') return { simulado: true };
    const parcial = req.monto < req.totalCobrado;
    const orden = await this.llamar('POST', `/v1/orders/${req.token}/refund`,
      parcial ? { transactions: [{ id: req.transactionId, amount: String(Math.round(req.monto)) }] } : undefined,
      { 'X-Idempotency-Key': req.idReverso });
    return { order_status: orden.status, status_detail: orden.status_detail, parcial };
  }

  /** Envia el monto a la maquina Point (Orders API). La orden queda esperando la tarjeta. */
  private async crearOrden(req: PaymentInitRequest): Promise<PaymentInitResponse> {
    const { modo, mercadoPago } = configPagos();
    exigir({ MP_ACCESS_TOKEN: mercadoPago.accessToken, MP_TERMINAL_ID: mercadoPago.terminalId }, 'Mercado Pago');

    const orden = await this.llamar('POST', '/v1/orders', {
      type: 'point',
      external_reference: req.saleId,
      description: 'Venta GesTock',
      transactions: { payments: [{ amount: String(Math.round(req.amount)) }] },
      config: { point: { terminal_id: mercadoPago.terminalId, print_on_terminal: 'no_ticket' } }
    }, { 'X-Idempotency-Key': req.saleId });

    // Sin maquina fisica el sandbox no avanza solo: se le pide el resultado a Mercado Pago
    if (modo === 'sandbox' && mercadoPago.resultadoSandbox) {
      await this.llamar('POST', `/v1/orders/${orden.id}/events`, { status: mercadoPago.resultadoSandbox });
    }

    logger.info('MercadoPagoGateway', `Orden ${orden.id} enviada al terminal ${mercadoPago.terminalId}`);
    return { token: orden.id, gateway: this.gatewayType, status: 'PENDING' };
  }

  /** Consulta la orden hasta que el cliente pague, la maquina la rechace o se agote la espera. */
  private async esperarOrden(req: PaymentConfirmRequest): Promise<PaymentTransactionResult> {
    const { esperaMaximaMs } = configPagos();
    const limite = Date.now() + esperaMaximaMs;
    let orden = await this.llamar('GET', `/v1/orders/${req.token}`);

    while (!FINALES.includes(orden.status) && Date.now() < limite) {
      await esperar(2000);
      orden = await this.llamar('GET', `/v1/orders/${req.token}`);
    }

    if (!FINALES.includes(orden.status)) {
      // Nadie pago a tiempo: se retira la orden de la maquina para que no cobre despues
      await this.llamar('POST', `/v1/orders/${req.token}/cancel`, undefined,
        { 'x-allow-cancelable-status': 'at_terminal' }).catch(() => undefined);
      orden = { ...orden, status: 'expired', status_detail: 'sin respuesta del cliente' };
    }

    const pago = orden.transactions?.payments?.[0] ?? {};
    return {
      transactionId: pago.id || orden.id,
      saleId: req.saleId,
      gateway: this.gatewayType,
      token: req.token,
      amount: Number(pago.amount) || 0,
      status: orden.status === 'processed' ? 'APPROVED' : 'REJECTED',
      authorizationCode: pago.reference_id,
      metadataResponse: {
        gateway: 'MercadoPago',
        order_status: orden.status,
        status_detail: orden.status_detail,
        payment_method: pago.payment_method?.id,
        card_type: pago.payment_method?.type
      },
      usedFallback: false,
      createdAt: new Date().toISOString()
    };
  }

  private async llamar(metodo: string, ruta: string, cuerpo?: unknown, cabeceras: Record<string, string> = {}): Promise<any> {
    const res = await this.http(`${API}${ruta}`, {
      method: metodo,
      headers: {
        Authorization: `Bearer ${configPagos().mercadoPago.accessToken}`,
        'Content-Type': 'application/json',
        ...cabeceras
      },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo)
    });
    const texto = await res.text();
    if (!res.ok) throw new Error(`Mercado Pago respondio ${res.status}: ${texto.slice(0, 300)}`);
    return texto ? JSON.parse(texto) : {};
  }
}

export const defaultMercadoPagoGateway = new MercadoPagoGateway();

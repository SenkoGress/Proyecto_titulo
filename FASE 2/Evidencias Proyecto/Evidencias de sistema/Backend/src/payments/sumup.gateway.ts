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

const API = 'https://api.sumup.com';

export class SumUpGateway implements IPaymentGateway {
  public gatewayType: PaymentGatewayType = 'SumUp';

  /** fetch inyectable para las pruebas. */
  constructor(private http: typeof fetch = fetch) {}

  public async initiatePayment(req: PaymentInitRequest): Promise<PaymentInitResponse> {
    if (configPagos().modo !== 'simulado') return this.enviarAlLector(req);
    if (req.simulateFailure) {
      throw new Error('SumUp Reader Bluetooth Disconnect / API Timeout');
    }

    logger.info('SumUpGateway', `Creating SumUp checkout for sale ${req.saleId}`);
    const token = `sumup_chk_${uuidv4().replace(/-/g, '')}`;

    return {
      token,
      paymentUrl: `https://api.sumup.com/v0.1/checkouts/${token}`,
      gateway: this.gatewayType,
      status: 'PENDING'
    };
  }

  public async confirmPayment(req: PaymentConfirmRequest): Promise<PaymentTransactionResult> {
    if (configPagos().modo !== 'simulado') return this.esperarTransaccion(req);
    if (req.simulateFailure) {
      throw new Error('SumUp transaction polling failed');
    }

    logger.info('SumUpGateway', `Verifying SumUp checkout ${req.token}`);

    return {
      transactionId: uuidv4(),
      saleId: req.saleId,
      gateway: this.gatewayType,
      token: req.token,
      amount: 1000,
      status: 'APPROVED',
      authorizationCode: 'SUMUP-AUTH-554',
      metadataResponse: {
        gateway: 'SumUp',
        status: 'PAID',
        entry_mode: 'CHIP_PIN',
        card_type: 'MASTERCARD',
        card_brand: 'Mastercard Débito',
        card_last4: '0554',
        card_masked: '**** **** **** 0554',
        pci_dss_compliant: true
      },
      usedFallback: false,
      createdAt: new Date().toISOString()
    };
  }

  /** POST /v1.0/merchants/{mc}/payments/{id}/refunds, en pesos; vuelve a la tarjeta del cliente. */
  public async reembolsar(req: ReembolsoRequest): Promise<Record<string, unknown>> {
    if (configPagos().modo === 'simulado') return { simulado: true };
    const { sumUp } = configPagos();
    await this.llamar('POST', `/v1.0/merchants/${sumUp.merchantCode}/payments/${req.transactionId}/refunds`,
      { amount: Math.round(req.monto) });
    return { parcial: req.monto < req.totalCobrado };
  }

  /**
   * Cloud API: el lector Solo emparejado recibe el monto. En sandbox el lector es el Virtual Solo
   * (virtual-solo.sumup.com) de una cuenta de comercio de pruebas, con el mismo codigo.
   */
  private async enviarAlLector(req: PaymentInitRequest): Promise<PaymentInitResponse> {
    const { sumUp } = configPagos();
    exigir({
      SUMUP_API_KEY: sumUp.apiKey,
      SUMUP_MERCHANT_CODE: sumUp.merchantCode,
      SUMUP_READER_ID: sumUp.readerId,
      SUMUP_AFFILIATE_KEY: sumUp.affiliateKey,
      SUMUP_APP_ID: sumUp.appId
    }, 'SumUp');

    const res = await this.llamar('POST', `/v0.1/merchants/${sumUp.merchantCode}/readers/${sumUp.readerId}/checkout`, {
      // El peso chileno no tiene decimales
      total_amount: { currency: 'CLP', minor_unit: 0, value: Math.round(req.amount) },
      description: 'Venta GesTock',
      affiliate: { app_id: sumUp.appId, key: sumUp.affiliateKey, foreign_transaction_id: req.saleId }
    });

    const idTransaccion = res?.data?.client_transaction_id ?? res?.client_transaction_id;
    if (!idTransaccion) throw new Error('SumUp acepto el cobro pero no devolvio client_transaction_id');
    logger.info('SumUpGateway', `Cobro enviado al lector ${sumUp.readerId}`);
    return { token: idTransaccion, gateway: this.gatewayType, status: 'PENDING' };
  }

  /**
   * SumUp avisa el resultado por webhook, que una caja sin direccion publica no puede recibir: se
   * consulta la transaccion por su client_transaction_id hasta que quede en un estado final.
   */
  private async esperarTransaccion(req: PaymentConfirmRequest): Promise<PaymentTransactionResult> {
    const { sumUp, esperaMaximaMs } = configPagos();
    const limite = Date.now() + esperaMaximaMs;
    const ruta = `/v2.1/merchants/${sumUp.merchantCode}/transactions?client_transaction_id=${encodeURIComponent(req.token)}`;
    let tx: any = null;
    let estado = 'PENDING';

    while (Date.now() < limite) {
      // Mientras el cliente no pasa la tarjeta, la transaccion todavia no existe (404)
      tx = await this.llamar('GET', ruta).catch((e: Error) => (/ 404/.test(e.message) ? null : Promise.reject(e)));
      estado = String(tx?.status || 'PENDING').toUpperCase();
      if (estado !== 'PENDING') break;
      await esperar(2000);
    }

    return {
      transactionId: tx?.id || req.token,
      saleId: req.saleId,
      gateway: this.gatewayType,
      token: req.token,
      amount: Number(tx?.amount) || 0,
      status: estado === 'SUCCESSFUL' ? 'APPROVED' : 'REJECTED',
      authorizationCode: tx?.transaction_code,
      metadataResponse: {
        gateway: 'SumUp',
        status: estado === 'PENDING' ? 'SIN_RESPUESTA' : estado,
        card_brand: tx?.card?.type,
        card_last4: tx?.card?.last_4_digits
      },
      usedFallback: false,
      createdAt: new Date().toISOString()
    };
  }

  private async llamar(metodo: string, ruta: string, cuerpo?: unknown): Promise<any> {
    const res = await this.http(`${API}${ruta}`, {
      method: metodo,
      headers: { Authorization: `Bearer ${configPagos().sumUp.apiKey}`, 'Content-Type': 'application/json' },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo)
    });
    const texto = await res.text();
    if (!res.ok) throw new Error(`SumUp respondio ${res.status}: ${texto.slice(0, 300)}`);
    return texto ? JSON.parse(texto) : {};
  }
}

export const defaultSumUpGateway = new SumUpGateway();

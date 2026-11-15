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
import { configPagos, esperar } from './pagos.config';

/** Lo que entrega el SDK de POS Integrado al terminar una venta (transbank-pos-sdk). */
export interface RespuestaVentaPos {
  responseCode: number;
  responseMessage?: string;
  successful?: boolean;
  authorizationCode?: string;
  amount?: number;
  last4Digits?: string | number;
  operationNumber?: string | number;
  cardType?: string;
  cardBrand?: string;
  commerceCode?: string | number;
  terminalId?: string;
}

/** La parte del SDK que se usa; permite reemplazar la maquina en las pruebas. */
export interface MaquinaPos {
  connect(puerto: string): Promise<unknown>;
  autoconnect(): Promise<unknown>;
  sale(monto: number, ticket: string): Promise<RespuestaVentaPos>;
  refund(numeroOperacion: string): Promise<RespuestaVentaPos>;
}

export class TransbankGateway implements IPaymentGateway {
  public gatewayType: PaymentGatewayType = 'Transbank';

  private maquina: MaquinaPos | null = null;
  private conectada = false;
  private resultados = new Map<string, PaymentTransactionResult>();

  /** maquina inyectable para las pruebas; en produccion es el POS Integrado del SDK oficial. */
  constructor(maquina?: MaquinaPos) {
    this.maquina = maquina ?? null;
  }

  public async initiatePayment(req: PaymentInitRequest): Promise<PaymentInitResponse> {
    if (configPagos().modo !== 'simulado') return this.venderEnMaquina(req);
    if (req.simulateFailure) {
      throw new Error('Transbank Webpay API Timeout / Service Unavailable (503)');
    }

    logger.info('TransbankGateway', `Initiating Webpay Plus transaction for sale ${req.saleId}`);
    const token = `tbk_token_${uuidv4().replace(/-/g, '')}`;

    return {
      token,
      paymentUrl: `https://webpay3gint.transbank.cl/webpayserver/initTransaction?token_ws=${token}`,
      gateway: this.gatewayType,
      status: 'PENDING'
    };
  }

  public async confirmPayment(req: PaymentConfirmRequest): Promise<PaymentTransactionResult> {
    if (configPagos().modo !== 'simulado') {
      const resultado = this.resultados.get(req.token);
      if (!resultado) throw new Error(`No hay una venta en la maquina Transbank con el ticket ${req.token}`);
      this.resultados.delete(req.token);
      return resultado;
    }
    if (req.simulateFailure) {
      throw new Error('Transbank confirmation timeout / network disconnect');
    }

    logger.info('TransbankGateway', `Confirming Webpay transaction for token ${req.token}`);

    return {
      transactionId: uuidv4(),
      saleId: req.saleId,
      gateway: this.gatewayType,
      token: req.token,
      amount: 1000, // Se complementará desde la venta en el dispatcher
      status: 'APPROVED',
      authorizationCode: '123456',
      metadataResponse: {
        gateway: 'Transbank',
        vci: 'TSY',
        payment_type_code: 'VD', // Venta Débito Redcompra
        card_brand: 'Redcompra / Visa Débito',
        card_last4: '4321',
        card_masked: '**** **** **** 4321',
        shares_number: 0,
        response_code: 0,
        pci_dss_compliant: true
      },
      usedFallback: false,
      createdAt: new Date().toISOString()
    };
  }

  /**
   * POS Integrado: la caja le manda el monto al terminal por USB o serie y el SDK espera a que el
   * cliente pague; la promesa se resuelve con la respuesta del terminal. Transbank no ofrece un
   * ambiente de pruebas para el POS Integrado, asi que en sandbox responde un terminal simulado con
   * la misma forma que el SDK y el resultado pasa por la misma lectura que en produccion.
   */
  private async venderEnMaquina(req: PaymentInitRequest): Promise<PaymentInitResponse> {
    const { modo } = configPagos();
    // El terminal acepta un ticket de hasta 6 caracteres
    const ticket = req.saleId.replace(/-/g, '').slice(0, 6).toUpperCase();

    const respuesta = modo === 'sandbox'
      ? await this.terminalDePrueba(req.amount)
      : await this.vender(Math.round(req.amount), ticket);

    const aprobada = Number(respuesta.responseCode) === 0;
    logger.info('TransbankGateway', `Terminal respondio ${respuesta.responseCode} (${respuesta.responseMessage ?? ''}) para el ticket ${ticket}`);

    this.resultados.set(ticket, {
      // El numero de operacion se repite entre terminales y dias: va en metadata, no como id
      transactionId: uuidv4(),
      saleId: req.saleId,
      gateway: this.gatewayType,
      token: ticket,
      amount: Number(respuesta.amount) || Math.round(req.amount),
      status: aprobada ? 'APPROVED' : 'REJECTED',
      authorizationCode: respuesta.authorizationCode,
      metadataResponse: {
        gateway: 'Transbank',
        modo,
        response_code: respuesta.responseCode,
        response_message: respuesta.responseMessage,
        card_type: respuesta.cardType,
        card_brand: respuesta.cardBrand,
        card_last4: respuesta.last4Digits !== undefined ? String(respuesta.last4Digits) : undefined,
        terminal_id: respuesta.terminalId,
        operation_number: respuesta.operationNumber !== undefined ? String(respuesta.operationNumber) : undefined
      },
      usedFallback: false,
      createdAt: new Date().toISOString()
    });
    return { token: ticket, gateway: this.gatewayType, status: 'PENDING' };
  }

  /**
   * Anulacion en el terminal por numero de operacion. El POS Integrado anula la venta completa:
   * una devolucion parcial no se puede reversar desde la caja.
   */
  public async reembolsar(req: ReembolsoRequest): Promise<Record<string, unknown>> {
    const { modo } = configPagos();
    if (modo === 'simulado') return { simulado: true };
    if (req.monto < req.totalCobrado) {
      throw new Error('el POS Integrado de Transbank solo anula la venta completa; una devolucion parcial se reversa desde el portal de Transbank');
    }
    const operacion = req.metadata.operation_number;
    if (!operacion) throw new Error('el cobro no guardo el numero de operacion del terminal');

    const respuesta = modo === 'sandbox'
      ? { responseCode: 0, responseMessage: 'Aprobado', authorizationCode: '000000' }
      : await this.anular(String(operacion));
    if (Number(respuesta.responseCode) !== 0) {
      throw new Error(`el terminal no anulo la venta: ${respuesta.responseMessage ?? `codigo ${respuesta.responseCode}`}`);
    }
    return { response_code: respuesta.responseCode, authorization_code: respuesta.authorizationCode, operation_number: operacion };
  }

  private async anular(operacion: string): Promise<RespuestaVentaPos> {
    const maquina = await this.conectar();
    try {
      return await maquina.refund(operacion);
    } catch (err) {
      this.conectada = false;
      throw err;
    }
  }

  private async vender(monto: number, ticket: string): Promise<RespuestaVentaPos> {
    const maquina = await this.conectar();
    try {
      return await maquina.sale(monto, ticket);
    } catch (err) {
      // Un cable desconectado deja el puerto inservible: la proxima venta vuelve a conectar
      this.conectada = false;
      throw err;
    }
  }

  private async conectar(): Promise<MaquinaPos> {
    if (!this.maquina) {
      // Se carga recien aqui: abre el puerto serie y solo hace falta con una maquina real
      const { POSIntegrado } = require('transbank-pos-sdk');
      this.maquina = new POSIntegrado() as MaquinaPos;
    }
    if (!this.conectada) {
      const { puerto } = configPagos().transbank;
      await (puerto ? this.maquina.connect(puerto) : this.maquina.autoconnect());
      this.conectada = true;
    }
    return this.maquina;
  }

  private async terminalDePrueba(monto: number): Promise<RespuestaVentaPos> {
    await esperar(1500);
    return {
      responseCode: 0,
      responseMessage: 'Aprobado',
      successful: true,
      authorizationCode: String(100000 + Math.floor(Math.random() * 900000)),
      amount: Math.round(monto),
      last4Digits: '6623',
      operationNumber: String(Date.now()).slice(-6),
      cardType: 'DB',
      cardBrand: 'TR',
      terminalId: 'SANDBOX'
    };
  }
}

export const defaultTransbankGateway = new TransbankGateway();

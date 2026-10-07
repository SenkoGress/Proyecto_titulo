import { v4 as uuidv4 } from 'uuid';
import { IPaymentGateway } from './payment-gateway.interface';
import {
  PaymentConfirmRequest,
  PaymentGatewayType,
  PaymentInitRequest,
  PaymentInitResponse,
  PaymentTransactionResult
} from './types';
import { logger } from '../utils/logger';

export class MercadoPagoGateway implements IPaymentGateway {
  public gatewayType: PaymentGatewayType = 'MercadoPago';

  public async initiatePayment(req: PaymentInitRequest): Promise<PaymentInitResponse> {
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
}

export const defaultMercadoPagoGateway = new MercadoPagoGateway();

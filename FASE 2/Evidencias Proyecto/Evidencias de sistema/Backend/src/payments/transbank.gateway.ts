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

export class TransbankGateway implements IPaymentGateway {
  public gatewayType: PaymentGatewayType = 'Transbank';

  public async initiatePayment(req: PaymentInitRequest): Promise<PaymentInitResponse> {
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
}

export const defaultTransbankGateway = new TransbankGateway();

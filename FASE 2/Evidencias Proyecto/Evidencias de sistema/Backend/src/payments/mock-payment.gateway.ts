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

export class MockPaymentGateway implements IPaymentGateway {
  public gatewayType: PaymentGatewayType = 'MockGateway';

  public async initiatePayment(req: PaymentInitRequest): Promise<PaymentInitResponse> {
    logger.warn('MockPaymentGateway', `Executing graceful offline fallback for payment initiation on sale ${req.saleId}`);
    const token = `offline_voucher_${uuidv4().slice(0, 8)}`;

    return {
      token,
      gateway: this.gatewayType,
      status: 'PENDING'
    };
  }

  public async confirmPayment(req: PaymentConfirmRequest): Promise<PaymentTransactionResult> {
    logger.warn('MockPaymentGateway', `Executing graceful fallback confirmation for token ${req.token}`);

    return {
      transactionId: uuidv4(),
      saleId: req.saleId,
      gateway: this.gatewayType,
      token: req.token,
      amount: 1000,
      status: 'APPROVED',
      authorizationCode: 'OFFLINE-CONTINGENCY-AUTH',
      metadataResponse: {
        mode: 'OFFLINE_CONTINGENCY_VOUCHER',
        reason: 'External Gateway Unavailable',
        fallbackActive: true
      },
      usedFallback: true,
      createdAt: new Date().toISOString()
    };
  }
}

export const defaultMockPaymentGateway = new MockPaymentGateway();

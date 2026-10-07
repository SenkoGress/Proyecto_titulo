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

export class SumUpGateway implements IPaymentGateway {
  public gatewayType: PaymentGatewayType = 'SumUp';

  public async initiatePayment(req: PaymentInitRequest): Promise<PaymentInitResponse> {
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
}

export const defaultSumUpGateway = new SumUpGateway();

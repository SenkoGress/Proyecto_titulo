import {
  PaymentConfirmRequest,
  PaymentGatewayType,
  PaymentInitRequest,
  PaymentInitResponse,
  PaymentTransactionResult
} from './types';

export interface IPaymentGateway {
  gatewayType: PaymentGatewayType;
  initiatePayment(req: PaymentInitRequest): Promise<PaymentInitResponse>;
  confirmPayment(req: PaymentConfirmRequest): Promise<PaymentTransactionResult>;
}

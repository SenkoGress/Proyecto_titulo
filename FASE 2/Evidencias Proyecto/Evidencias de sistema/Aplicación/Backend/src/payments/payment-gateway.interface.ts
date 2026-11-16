import {
  PaymentConfirmRequest,
  PaymentGatewayType,
  PaymentInitRequest,
  PaymentInitResponse,
  PaymentTransactionResult,
  ReembolsoRequest
} from './types';

export interface IPaymentGateway {
  gatewayType: PaymentGatewayType;
  initiatePayment(req: PaymentInitRequest): Promise<PaymentInitResponse>;
  confirmPayment(req: PaymentConfirmRequest): Promise<PaymentTransactionResult>;
  /** Devuelve al cliente un cobro aprobado, completo o en parte. Falla con el motivo si no puede. */
  reembolsar?(req: ReembolsoRequest): Promise<Record<string, unknown>>;
}

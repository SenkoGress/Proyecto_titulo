export type PaymentGatewayType = 'Transbank' | 'MercadoPago' | 'SumUp' | 'RutPay' | 'MockGateway';
export type PaymentStatus = 'APPROVED' | 'REJECTED' | 'PENDING';

export interface PaymentInitRequest {
  saleId: string;
  tenantId: string;
  amount: number;
  gateway: PaymentGatewayType;
  returnUrl?: string;
  simulateFailure?: boolean; // Para inducir degradación elegante en pruebas
}

export interface PaymentInitResponse {
  token: string;
  paymentUrl?: string;
  gateway: PaymentGatewayType;
  status: PaymentStatus;
}

export interface PaymentConfirmRequest {
  token: string;
  saleId: string;
  tenantId: string;
  gateway: PaymentGatewayType;
  simulateFailure?: boolean;
}

export interface PaymentTransactionResult {
  transactionId: string;
  saleId: string;
  gateway: PaymentGatewayType;
  token: string;
  amount: number;
  status: PaymentStatus;
  authorizationCode?: string;
  metadataResponse: Record<string, unknown>;
  usedFallback: boolean;
  createdAt: string;
}

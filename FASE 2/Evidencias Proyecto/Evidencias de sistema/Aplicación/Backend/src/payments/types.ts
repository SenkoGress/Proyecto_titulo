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

/**
 * El proveedor no puede devolver el dinero desde la caja, por como funciona y no por una falla:
 * la devolucion sigue, con su nota de credito, y el dinero se devuelve a mano o por el portal.
 */
export class ReversoManual extends Error {
  constructor(motivo: string) {
    super(motivo);
    this.name = 'ReversoManual';
  }
}

export interface ReembolsoRequest {
  /** Token con que se cobro: orden de Mercado Pago, ticket de Transbank, checkout de SumUp. */
  token: string;
  /** Id del pago en el proveedor (payment_transactions.id). */
  transactionId: string;
  metadata: Record<string, any>;
  monto: number;
  /** Lo que se cobro: si monto es menor, el reembolso es parcial. */
  totalCobrado: number;
  /** Id de la devolucion, que sirve de clave de idempotencia. */
  idReverso: string;
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

/** Falla del cobro que el cajero tiene que leer tal cual, tambien en produccion. */
export class AvisoDeCobro extends Error {}

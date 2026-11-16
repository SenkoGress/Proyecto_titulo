import { v4 as uuidv4 } from 'uuid';
import { PostgresClient, defaultPgClient } from '../database/postgres/client';
import { defaultSqliteClient } from '../database/sqlite/client';
import { logger } from '../utils/logger';
import { defaultMercadoPagoGateway } from './mercadopago.gateway';
import { defaultMockPaymentGateway } from './mock-payment.gateway';
import { IPaymentGateway } from './payment-gateway.interface';
import { defaultSumUpGateway } from './sumup.gateway';
import { defaultTransbankGateway } from './transbank.gateway';
import { defaultRutPayGateway } from './rutpay.gateway';
import {
  PaymentConfirmRequest,
  PaymentGatewayType,
  PaymentInitRequest,
  PaymentInitResponse,
  PaymentTransactionResult,
  ReversoManual
} from './types';
import { configPagos } from './pagos.config';

export class PaymentDispatcherService {
  private pgClient: PostgresClient;
  private gateways: Map<PaymentGatewayType, IPaymentGateway>;
  private fallbackGateway: IPaymentGateway;

  constructor(customPgClient?: PostgresClient, customGateways?: Map<PaymentGatewayType, IPaymentGateway>) {
    this.pgClient = customPgClient || defaultPgClient;
    this.fallbackGateway = defaultMockPaymentGateway;

    this.gateways = customGateways || new Map<PaymentGatewayType, IPaymentGateway>([
      ['Transbank', defaultTransbankGateway],
      ['MercadoPago', defaultMercadoPagoGateway],
      ['SumUp', defaultSumUpGateway],
      ['RutPay', defaultRutPayGateway],
      ['MockGateway', defaultMockPaymentGateway]
    ]);
  }

  public async initiatePayment(req: PaymentInitRequest): Promise<PaymentInitResponse & { usedFallback: boolean }> {
    const gateway = this.gateways.get(req.gateway);

    if (!gateway) {
      throw new Error(`Unsupported payment gateway: ${req.gateway}`);
    }

    try {
      const response = await gateway.initiatePayment(req);
      return {
        ...response,
        usedFallback: false
      };
    } catch (err) {
      // Con una maquina real, una falla no puede terminar en un cobro aprobado por el simulador
      if (configPagos().modo !== 'simulado') throw err;
      // Modo contingencia: conmutacion automatica a simulador local ante caida del proveedor externo
      logger.warn('PaymentDispatcher', `Gateway ${req.gateway} failed during initiation. Activating graceful degradation mock.`, {
        error: err instanceof Error ? err.message : String(err)
      });

      const fallbackResponse = await this.fallbackGateway.initiatePayment(req);
      return {
        ...fallbackResponse,
        usedFallback: true
      };
    }
  }

  public async confirmPayment(req: PaymentConfirmRequest): Promise<PaymentTransactionResult> {
    const startTime = Date.now();
    const gateway = this.gateways.get(req.gateway);

    if (!gateway) {
      throw new Error(`Unsupported payment gateway: ${req.gateway}`);
    }

    // 1. Obtener la venta desde la base de datos (PostgreSQL o SQLite local)
    let saleAmount = 0;
    try {
      const saleResult = await this.pgClient.query<{ id: string; total: string; estado: string }>(
        'SELECT id, total, estado FROM transacciones_venta WHERE id = $1 AND tenant_id = $2',
        [req.saleId, req.tenantId]
      );
      if (saleResult.rows.length > 0) {
        saleAmount = parseFloat(saleResult.rows[0].total);
      }
    } catch {
      // Ignorar si Postgres está offline
    }

    if (!saleAmount) {
      const sqliteSale = defaultSqliteClient.queryOne<{ id: string; total: number }>(
        'SELECT id, total FROM transacciones_venta WHERE id = ? AND tenant_id = ?',
        [req.saleId, req.tenantId]
      );
      if (sqliteSale) {
        saleAmount = Number(sqliteSale.total);
      }
    }

    if (!saleAmount) {
      throw new Error(`Sale with ID ${req.saleId} not found for tenant ${req.tenantId}`);
    }

    let txResult: PaymentTransactionResult;

    // 2. Confirmación con la pasarela seleccionada o fallback
    try {
      txResult = await gateway.confirmPayment(req);
      txResult.amount = saleAmount;
    } catch (err) {
      const detalle = err instanceof Error ? err.message : String(err);
      if (configPagos().modo !== 'simulado') {
        txResult = rechazado(req.saleId, req.gateway, req.token, saleAmount, detalle);
      } else {
        logger.warn('PaymentDispatcher', `Gateway ${req.gateway} confirmation failed. Applying offline contingency voucher.`, {
          error: detalle
        });
        txResult = await this.fallbackGateway.confirmPayment(req);
        txResult.amount = saleAmount;
        txResult.usedFallback = true;
      }
    }

    await this.registrarPago(txResult);
    const duration = Date.now() - startTime;
    logger.info('PaymentDispatcher', `Payment transaction ${txResult.transactionId} completed in ${duration}ms with status ${txResult.status}`);
    return txResult;
  }

  /**
   * Cobra en la maquina antes de que exista la venta: el checkout solo escribe la venta y descuenta
   * stock si el resultado es APPROVED. Fuera del modo simulado, una falla se propaga con su motivo.
   */
  public async cobrar(req: { saleId: string; tenantId: string; amount: number; gateway: PaymentGatewayType }): Promise<PaymentTransactionResult> {
    const inicio = await this.initiatePayment(req);
    const gateway = inicio.usedFallback ? this.fallbackGateway : this.gateways.get(req.gateway)!;
    const resultado = await gateway.confirmPayment({ token: inicio.token, saleId: req.saleId, tenantId: req.tenantId, gateway: req.gateway });
    return { ...resultado, gateway: req.gateway, amount: Math.round(req.amount), usedFallback: inicio.usedFallback };
  }

  /**
   * Devuelve en la maquina lo cobrado con tarjeta en una venta, antes de emitir la nota de credito.
   * Devuelve null si la venta no tuvo cobro con tarjeta (efectivo). Lanza el motivo si no se pudo.
   */
  public async reembolsar(ventaId: string, monto: number, idReverso: string): Promise<PaymentTransactionResult | null> {
    const pago = defaultSqliteClient.queryOne<{ id: string; pasarela: PaymentGatewayType; transaction_token: string; monto: number; metadata_response: string | null }>(
      `SELECT id, pasarela, transaction_token, monto, metadata_response FROM payment_transactions
       WHERE sale_id = ? AND estado_transaccion = 'APPROVED' ORDER BY created_at DESC LIMIT 1`,
      [ventaId]
    );
    if (!pago) return null;

    const metadata = pago.metadata_response ? JSON.parse(pago.metadata_response) : {};
    const gateway = this.gateways.get(pago.pasarela);
    let detalle: Record<string, unknown>;
    let manual: string | null = null;
    try {
      if (gateway?.reembolsar) {
        detalle = await gateway.reembolsar({
          token: pago.transaction_token,
          transactionId: pago.id,
          metadata,
          monto: Math.round(monto),
          totalCobrado: Number(pago.monto),
          idReverso
        });
      } else if (configPagos().modo === 'simulado') {
        detalle = { simulado: true };
      } else {
        throw new ReversoManual(`${pago.pasarela} no permite devolver el pago desde la caja: devuelve el dinero en efectivo o por transferencia`);
      }
    } catch (err) {
      // Una falla del proveedor corta la devolucion para reintentar; una imposibilidad por diseño no,
      // porque el cliente igual tiene derecho a su nota de credito
      if (!(err instanceof ReversoManual)) throw err;
      manual = err.message;
      detalle = { motivo: manual };
    }

    return {
      transactionId: uuidv4(),
      saleId: idReverso,
      gateway: pago.pasarela,
      token: pago.transaction_token,
      amount: -Math.round(monto),
      status: manual ? 'PENDING' : 'APPROVED',
      metadataResponse: { tipo: manual ? 'REVERSO_MANUAL' : 'REVERSO', venta_original: ventaId, pago_original: pago.id, ...detalle },
      usedFallback: false,
      createdAt: new Date().toISOString()
    };
  }

  /** Guarda el resultado del cobro y marca la venta como PAGADA si se aprobo. */
  public async registrarPago(txResult: PaymentTransactionResult, marcarPagada = true): Promise<void> {
    const req = { saleId: txResult.saleId, gateway: txResult.gateway };

    // 3. Persistir en SQLite local de inmediato
    try {
      defaultSqliteClient.execute(
        `INSERT OR REPLACE INTO payment_transactions 
         (id, sale_id, pasarela, transaction_token, monto, estado_transaccion, metadata_response)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          txResult.transactionId,
          req.saleId,
          txResult.usedFallback ? 'MockGateway' : req.gateway,
          txResult.token,
          txResult.amount,
          txResult.status,
          JSON.stringify(txResult.metadataResponse)
        ]
      );

      if (txResult.status === 'APPROVED' && marcarPagada) {
        defaultSqliteClient.execute(
          `UPDATE transacciones_venta SET estado = 'PAGADA' WHERE id = ?`,
          [req.saleId]
        );
      }
    } catch (sqliteErr) {
      logger.warn('PaymentDispatcher', 'Failed to record payment in SQLite', { sqliteErr });
    }

    // 4. Persistir en PostgreSQL Cloud (si está online)
    try {
      await this.pgClient.withTransaction(async (client) => {
        await client.query(
          `INSERT INTO payment_transactions 
           (id, sale_id, pasarela, transaction_token, monto, estado_transaccion, metadata_response)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT DO NOTHING`,
          [
            txResult.transactionId,
            req.saleId,
            txResult.usedFallback ? 'MockGateway' : req.gateway,
            txResult.token,
            txResult.amount,
            txResult.status,
            JSON.stringify(txResult.metadataResponse)
          ]
        );

        if (txResult.status === 'APPROVED' && marcarPagada) {
          await client.query(
            `UPDATE transacciones_venta 
             SET estado = 'PAGADA' 
             WHERE id = $1`,
            [req.saleId]
          );
        }
      });
    } catch (pgErr) {
      logger.warn('PaymentDispatcher', 'Cloud PostgreSQL unreachable for payment persistence; will sync via push.', { pgErr });
    }
  }

  public async getTransactionsBySale(saleId: string): Promise<any[]> {
    try {
      if (this.pgClient.isCloudAvailable()) {
        const res = await this.pgClient.query(
          'SELECT * FROM payment_transactions WHERE sale_id = $1 ORDER BY created_at DESC',
          [saleId]
        );
        if (res.rows.length > 0) return res.rows;
      }
    } catch {
      // Fallback a SQLite local en modo offline
    }
    return defaultSqliteClient.query<any>(
      'SELECT * FROM payment_transactions WHERE sale_id = ? ORDER BY created_at DESC',
      [saleId]
    );
  }
}

export const defaultPaymentDispatcher = new PaymentDispatcherService();

function rechazado(saleId: string, gateway: PaymentGatewayType, token: string, amount: number, motivo: string): PaymentTransactionResult {
  return {
    transactionId: uuidv4(),
    saleId,
    gateway,
    token,
    amount,
    status: 'REJECTED',
    metadataResponse: { gateway, error: motivo },
    usedFallback: false,
    createdAt: new Date().toISOString()
  };
}

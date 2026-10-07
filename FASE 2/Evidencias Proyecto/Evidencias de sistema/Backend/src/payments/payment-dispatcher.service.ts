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
  PaymentTransactionResult
} from './types';

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
      logger.warn('PaymentDispatcher', `Gateway ${req.gateway} confirmation failed. Applying offline contingency voucher.`, {
        error: err instanceof Error ? err.message : String(err)
      });

      txResult = await this.fallbackGateway.confirmPayment(req);
      txResult.amount = saleAmount;
      txResult.usedFallback = true;
    }

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

      if (txResult.status === 'APPROVED') {
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

        if (txResult.status === 'APPROVED') {
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

    const duration = Date.now() - startTime;
    logger.info('PaymentDispatcher', `Payment transaction ${txResult.transactionId} completed in ${duration}ms with status ${txResult.status}`);

    return txResult;
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

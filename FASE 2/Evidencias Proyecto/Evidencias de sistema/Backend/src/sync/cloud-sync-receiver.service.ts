import { v4 as uuidv4 } from 'uuid';
import { PostgresClient, defaultPgClient } from '../database/postgres/client';
import { Producto } from '../database/types';
import { logger } from '../utils/logger';
import { SyncPullResponse, SyncPushPayload, SyncPushResponse } from './types';

export class CloudSyncReceiverService {
  private pgClient: PostgresClient;

  constructor(customPgClient?: PostgresClient) {
    this.pgClient = customPgClient || defaultPgClient;
  }

  public async ingestPushBatch(payload: SyncPushPayload): Promise<SyncPushResponse> {
    const startTime = Date.now();
    const syncedIds: string[] = [];
    const failedIds: string[] = [];

    if (!payload.tenant_id || !payload.sales || payload.sales.length === 0) {
      return {
        success: true,
        synced_ids: [],
        failed_ids: [],
        processed_at: new Date().toISOString(),
        message: 'No sales to process'
      };
    }

    try {
      await this.pgClient.withTransaction(async (client) => {
        // Asegurar que exista el tipo de movimiento de venta en el catálogo maestro
        const movTipoRes = await client.query<{ id: string }>(
          `INSERT INTO movimientos_inventario_tipos (id, nombre, codigo, descripcion)
           VALUES ($1, 'Venta en Punto de Venta', 'VENTA_POS', 'Deducción de inventario por venta POS offline-first')
           ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre
           RETURNING id`,
          [uuidv4()]
        );
        const movTipoId = movTipoRes.rows[0].id;

        for (const item of payload.sales) {
          const { sale, details } = item;

          try {
            // 1. Idempotencia: Verificar si la transacción ya fue consolidada en la nube
            const existingSale = await client.query<{ id: string; sync_status: string }>(
              'SELECT id, sync_status FROM transacciones_venta WHERE id = $1',
              [sale.id]
            );

            if (existingSale.rows.length > 0) {
              logger.info('CloudSyncReceiver', `Sale ${sale.id} already exists in cloud. Skipping duplicate ingestion.`);
              syncedIds.push(sale.id);
              continue;
            }

            // Validar o fallback seguro para metodo_pago_id para evitar abortos por Foreign Key
            let effectiveMetodoPagoId = sale.metodo_pago_id || null;
            if (effectiveMetodoPagoId) {
              const mpCheck = await client.query('SELECT id FROM metodos_pago WHERE id = $1', [effectiveMetodoPagoId]);
              if (mpCheck.rows.length === 0) {
                logger.warn('CloudSyncReceiver', `metodo_pago_id ${effectiveMetodoPagoId} not found in cloud, falling back to EFECTIVO`);
                const efCheck = await client.query("SELECT id FROM metodos_pago WHERE pasarela = 'EFECTIVO' LIMIT 1");
                effectiveMetodoPagoId = efCheck.rows[0]?.id || null;
              }
            }

            // 2. Insertar cabecera de Transacciones_Venta (El POS manda en Transacciones) con soporte DTE
            await client.query(
              `INSERT INTO transacciones_venta 
               (id, tenant_id, usuario_id, folio_local_sqlite, fecha, total, unidades, estado, rut_cliente, observaciones, metodo_pago_id, sync_status, last_synced_at, tipo_documento_tributario, dte_folio, dte_id, monto_ila, es_devolucion, referencia_venta_id, is_dirty, sync_attempts)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'SYNCED', now(), $12, $13, $14, $15, $16, $17, 0, 0)
               ON CONFLICT (id) DO UPDATE SET
                 sync_status = 'SYNCED',
                 last_synced_at = now(),
                 is_dirty = 0`,
              [
                sale.id,
                payload.tenant_id,
                sale.usuario_id,
                sale.folio_local_sqlite || null,
                sale.fecha || new Date().toISOString(),
                sale.total,
                sale.unidades,
                sale.estado || 'COMPLETADA',
                sale.rut_cliente || null,
                sale.observaciones || null,
                effectiveMetodoPagoId,
                (sale as any).tipo_documento_tributario || null,
                (sale as any).dte_folio || null,
                (sale as any).dte_id || null,
                (sale as any).monto_ila || 0,
                (sale as any).es_devolucion ? 1 : 0,
                (sale as any).referencia_venta_id || null
              ]
            );

            // 3. Procesar detalles e implementar Resolución de Conflicto de Stock por Delta Neto
            for (const detail of details) {
              await client.query(
                `INSERT INTO detalle_venta (id, venta_id, producto_id, cantidad, precio_unitario, subtotal)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (id) DO NOTHING`,
                [
                  detail.id || uuidv4(),
                  sale.id,
                  detail.producto_id,
                  detail.cantidad,
                  detail.precio_unitario,
                  detail.subtotal
                ]
              );

              // Consultar producto con bloqueo pesimista en la nube (FOR UPDATE)
              const prodResult = await client.query<{ id: string; stock_actual: string; nombre: string }>(
                `SELECT id, stock_actual, nombre 
                 FROM productos 
                 WHERE id = $1 AND tenant_id = $2 
                 FOR UPDATE`,
                [detail.producto_id, payload.tenant_id]
              );

              if (prodResult.rows.length > 0) {
                const prod = prodResult.rows[0];
                const currentCloudStock = parseFloat(prod.stock_actual);
                const delta = -parseFloat(String(detail.cantidad));
                const newCloudStock = currentCloudStock + delta;

                // Actualizar stock neto en la nube (preserva modificaciones concurrentes de otros canales)
                await client.query(
                  `UPDATE productos 
                   SET stock_actual = $1, updated_at = now() 
                   WHERE id = $2 AND tenant_id = $3`,
                  [newCloudStock, detail.producto_id, payload.tenant_id]
                );

                // Registrar auditoría en historial_stock
                await client.query(
                  `INSERT INTO historial_stock 
                   (id, tenant_id, producto_id, cambio_anterior, nuevo_stock, cambio, tipo_movimiento, motivo, usuario_registro)
                   VALUES ($1, $2, $3, $4, $5, $6, 'venta', $7, 'POS Offline-First Sync')`,
                  [
                    uuidv4(),
                    payload.tenant_id,
                    detail.producto_id,
                    currentCloudStock,
                    newCloudStock,
                    delta,
                    `Sincronización venta offline folio: ${sale.folio_local_sqlite || sale.id}`
                  ]
                );

                // Registrar auditoría en movimientos_inventario
                await client.query(
                  `INSERT INTO movimientos_inventario 
                   (id, tenant_id, producto_id, tipo_movimiento_id, cantidad, saldo_anterior, nuevo_saldo, id_origen, tipo_origen, usuario_registro)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'VENTA_POS', 'POS Sync')`,
                  [
                    uuidv4(),
                    payload.tenant_id,
                    detail.producto_id,
                    movTipoId,
                    Math.abs(delta),
                    currentCloudStock,
                    newCloudStock,
                    sale.id
                  ]
                );
              }
            }

            syncedIds.push(sale.id);
          } catch (saleErr) {
            logger.error('CloudSyncReceiver', `Failed to process individual sale: ${sale.id}`, saleErr);
            failedIds.push(sale.id);
            throw saleErr; // Desencadena ROLLBACK de la transacción completa del lote para garantizar atomicidad
          }
        }
      });

      const duration = Date.now() - startTime;
      logger.info('CloudSyncReceiver', `Successfully ingested sync push batch in ${duration}ms`, {
        syncedCount: syncedIds.length,
        duration
      });

      return {
        success: true,
        synced_ids: syncedIds,
        failed_ids: failedIds,
        processed_at: new Date().toISOString(),
        message: `Successfully processed ${syncedIds.length} sales`
      };
    } catch (error) {
      logger.error('CloudSyncReceiver', 'Batch sync ingestion failed', error, {
        tenantId: payload.tenant_id
      });
      return {
        success: false,
        synced_ids: [],
        failed_ids: payload.sales.map((s) => s.sale.id),
        processed_at: new Date().toISOString(),
        message: error instanceof Error ? error.message : 'Unknown sync error'
      };
    }
  }

  public async getPullUpdates(tenantId: string, lastPullTimestamp?: string | null): Promise<SyncPullResponse> {
    try {
      let query = 'SELECT * FROM productos WHERE tenant_id = $1';
      const params: unknown[] = [tenantId];

      if (lastPullTimestamp) {
        query += ' AND updated_at > $2';
        params.push(lastPullTimestamp);
      }

      query += ' ORDER BY updated_at ASC';

      const result = await this.pgClient.query<Producto>(query, params);

      return {
        success: true,
        products: result.rows,
        server_timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('CloudSyncReceiver', 'Failed to retrieve catalog pull updates', error, { tenantId });
      throw error;
    }
  }
}

export const defaultCloudSyncReceiver = new CloudSyncReceiverService();

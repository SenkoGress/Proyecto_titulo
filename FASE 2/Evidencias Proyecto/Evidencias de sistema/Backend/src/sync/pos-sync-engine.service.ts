import { SqliteClient, defaultSqliteClient } from '../database/sqlite/client';
import { DetalleVenta, Producto, TransaccionVenta } from '../database/types';
import { logger } from '../utils/logger';
import { defaultCloudSyncReceiver } from './cloud-sync-receiver.service';
import { ConflictResolver, defaultConflictResolver } from './conflict-resolver';
import { ExponentialBackoff, defaultBackoff } from './exponential-backoff';
import {
  SyncPullRequest,
  SyncPullResponse,
  SyncPushItem,
  SyncPushPayload,
  SyncPushResponse
} from './types';

export class PosSyncEngineService {
  private sqlite: SqliteClient;
  private backoff: ExponentialBackoff;
  private resolver: ConflictResolver;
  private deviceId: string;

  constructor(
    customSqlite?: SqliteClient,
    customBackoff?: ExponentialBackoff,
    customResolver?: ConflictResolver,
    deviceId = 'POS-LOCAL-DEVICE-01'
  ) {
    this.sqlite = customSqlite || defaultSqliteClient;
    this.backoff = customBackoff || defaultBackoff;
    this.resolver = customResolver || defaultConflictResolver;
    this.deviceId = deviceId;
  }

  public getPendingDirtySales(tenantId: string): SyncPushItem[] {
    const dirtySales = this.sqlite.query<TransaccionVenta>(
      `SELECT * FROM transacciones_venta 
       WHERE tenant_id = ? AND (is_dirty = 1 OR sync_status IN ('PENDING', 'FAILED'))
       ORDER BY fecha ASC`,
      [tenantId]
    );

    const items: SyncPushItem[] = [];

    for (const sale of dirtySales) {
      const details = this.sqlite.query<DetalleVenta>(
        'SELECT * FROM detalle_venta WHERE venta_id = ?',
        [sale.id]
      );
      items.push({ sale, details });
    }

    return items;
  }

  public async syncPush(
    tenantId: string,
    transport?: (payload: SyncPushPayload) => Promise<SyncPushResponse>
  ): Promise<SyncPushResponse> {
    const transportFn = transport || (async (p: SyncPushPayload) => defaultCloudSyncReceiver.ingestPushBatch(p));
    const pending = this.getPendingDirtySales(tenantId);

    if (pending.length === 0) {
      return {
        success: true,
        synced_ids: [],
        failed_ids: [],
        processed_at: new Date().toISOString(),
        message: 'No pending offline sales to sync'
      };
    }

    const payload: SyncPushPayload = {
      tenant_id: tenantId,
      device_id: this.deviceId,
      sales: pending
    };

    try {
      const response = await transportFn(payload);

      if (response.success && response.synced_ids.length > 0) {
        // Actualizar en SQLite local de forma atómica
        this.sqlite.withTransaction(() => {
          for (const syncedId of response.synced_ids) {
            this.sqlite.execute(
              `UPDATE transacciones_venta 
               SET is_dirty = 0, sync_status = 'SYNCED', sync_attempts = 0, last_synced_at = datetime('now')
               WHERE id = ?`,
              [syncedId]
            );
          }
        });

        logger.info('PosSyncEngine', `Synced ${response.synced_ids.length} sales with cloud`);
      }

      return response;
    } catch (networkError) {
      // Degeneración elegante ante cortes de red: el POS sigue 100% operativo
      logger.warn('PosSyncEngine', 'Network failure during push sync. Applying Exponential Backoff.', {
        error: networkError instanceof Error ? networkError.message : String(networkError)
      });

      this.sqlite.withTransaction(() => {
        for (const item of pending) {
          const currentAttempts = (item.sale.sync_attempts || 0) + 1;
          const nextRetry = this.backoff.getNextRetryTimestamp(currentAttempts);

          this.sqlite.execute(
            `UPDATE transacciones_venta 
             SET sync_attempts = ?, sync_status = 'FAILED'
             WHERE id = ?`,
            [currentAttempts, item.sale.id]
          );

          logger.debug('PosSyncEngine', `Sale ${item.sale.id} scheduled for retry at ${nextRetry.toISOString()}`);
        }
      });

      return {
        success: false,
        synced_ids: [],
        failed_ids: pending.map((p) => p.sale.id),
        processed_at: new Date().toISOString(),
        message: 'Offline mode active: transactions retained locally for retry'
      };
    }
  }

  public async syncPullCatalog(
    tenantId: string,
    transport?: (req: SyncPullRequest) => Promise<SyncPullResponse>,
    lastPullTimestamp?: string | null
  ): Promise<number> {
    const transportFn = transport || (async (r: SyncPullRequest) => defaultCloudSyncReceiver.getPullUpdates(r.tenant_id, r.last_pull_timestamp || undefined));
    try {
      const response = await transportFn({
        tenant_id: tenantId,
        last_pull_timestamp: lastPullTimestamp
      });

      if (!response.success || !response.products) {
        return 0;
      }

      let updatedCount = 0;

      this.sqlite.withTransaction(() => {
        for (const cloudProd of response.products) {
          const localProd = this.sqlite.queryOne<Producto>(
            'SELECT * FROM productos WHERE id = ? AND tenant_id = ?',
            [cloudProd.id, tenantId]
          );

          if (localProd) {
            // Aplicar política: La Nube manda en Catálogo (precios y productos)
            const reconciled = this.resolver.resolveCatalogConflict(localProd, cloudProd);

            this.sqlite.execute(
              `UPDATE productos 
               SET precio_compra = ?, precio_venta = ?, nombre = ?, activo = ?, updated_at = datetime('now')
               WHERE id = ? AND tenant_id = ?`,
              [
                reconciled.precio_compra,
                reconciled.precio_venta,
                reconciled.nombre,
                reconciled.activo ? 1 : 0,
                cloudProd.id,
                tenantId
              ]
            );
            updatedCount++;
          } else {
            // Si no existía localmente, insertarlo desde la nube
            this.sqlite.execute(
              `INSERT INTO productos 
               (id, tenant_id, proveedor_id, codigo_barra, sku, nombre, stock_actual, stock_minimo, precio_compra, precio_venta, categoria, activo)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                cloudProd.id,
                tenantId,
                cloudProd.proveedor_id || null,
                cloudProd.codigo_barra || null,
                cloudProd.sku,
                cloudProd.nombre,
                cloudProd.stock_actual,
                cloudProd.stock_minimo,
                cloudProd.precio_compra,
                cloudProd.precio_venta,
                cloudProd.categoria || null,
                cloudProd.activo ? 1 : 0
              ]
            );
            updatedCount++;
          }
        }
      });

      logger.info('PosSyncEngine', `Reconciled ${updatedCount} products from Cloud catalog`);
      return updatedCount;
    } catch (err) {
      logger.error('PosSyncEngine', 'Catalog pull failed', err);
      throw err;
    }
  }
}

export const defaultPosSyncEngine = new PosSyncEngineService();

import { SqliteClient, defaultSqliteClient } from '../database/sqlite/client';
import { DetalleVenta, Producto, TransaccionVenta } from '../database/types';
import { logger } from '../utils/logger';
import { ProductoReferenciado, ProveedorReferenciado } from './types';
import { defaultCloudSyncReceiver } from './cloud-sync-receiver.service';
import { ConflictResolver, defaultConflictResolver } from './conflict-resolver';
import { ExponentialBackoff, defaultBackoff } from './exponential-backoff';
import {
  RespaldoCatalogoResultado,
  SyncPullRequest,
  SyncPullResponse,
  SyncPushItem,
  SyncPushPayload,
  SyncPushResponse
} from './types';

/**
 * Intentos antes de dejar una venta detenida. Un corte de red se resuelve solo cuando vuelve la
 * conexion, pero un rechazo por el dato mismo no mejora por insistir: la venta queda en FAILED
 * con los intentos agotados, fuera del ciclo, y la interfaz puede mostrarla para revision.
 */
export const TOPE_REINTENTOS_VENTA = 5;

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
         AND COALESCE(sync_attempts, 0) < ?
       ORDER BY fecha ASC`,
      [tenantId, TOPE_REINTENTOS_VENTA]
    );

    const items: SyncPushItem[] = [];

    for (const sale of dirtySales) {
      const details = this.sqlite.query<DetalleVenta>(
        'SELECT * FROM detalle_venta WHERE venta_id = ?',
        [sale.id]
      );
      // Los productos creados en el terminal pueden no existir en la nube. Viajan con la venta
      // para que el receptor los registre antes de insertar el detalle.
      const idsProducto = Array.from(new Set(details.map((d) => d.producto_id).filter(Boolean)));
      const productos = idsProducto.length
        ? this.sqlite.query<ProductoReferenciado>(
            `SELECT id, sku, codigo_barra, nombre, precio_compra, precio_venta, proveedor_id
             FROM productos WHERE id IN (${idsProducto.map(() => '?').join(',')})`,
            idsProducto
          )
        : [];

      // Los productos declaran proveedor: si ese proveedor no existe arriba, el producto
      // tampoco se puede crear. El envio lleva exactamente lo que necesita para ser valido.
      const idsProveedor = Array.from(
        new Set(productos.map((p) => p.proveedor_id).filter((id): id is string => Boolean(id)))
      );
      const proveedores = idsProveedor.length
        ? this.sqlite.query<ProveedorReferenciado>(
            `SELECT id, rut_proveedor, nombre_proveedores, email
             FROM proveedores WHERE id IN (${idsProveedor.map(() => '?').join(',')})`,
            idsProveedor
          )
        : [];

      items.push({ sale, details, productos, proveedores });
    }

    return items;
  }

  public async syncPush(
    tenantId: string,
    transport?: (payload: SyncPushPayload) => Promise<SyncPushResponse>,
    soloEstas?: SyncPushItem[]
  ): Promise<SyncPushResponse> {
    const transportFn = transport || (async (p: SyncPushPayload) => defaultCloudSyncReceiver.ingestPushBatch(p));
    const pending = soloEstas || this.getPendingDirtySales(tenantId);

    if (pending.length === 0) {
      return {
        success: true,
        synced_ids: [],
        failed_ids: [],
        processed_at: new Date().toISOString(),
        message: 'No pending offline sales to sync'
      };
    }

    // Cada venta viaja en su propio envio. Antes iba el lote completo en una sola transaccion,
    // de modo que un registro que la nube rechazara impedia sincronizar TODAS las ventas
    // pendientes, incluidas las correctas. La venta es la unidad de trabajo de la caja y por eso
    // es la granularidad adecuada para la atomicidad.
    if (pending.length > 1) {
      const sincronizadas: string[] = [];
      const fallidas: string[] = [];
      const motivos: string[] = [];

      for (const item of pending) {
        const parcial = await this.syncPush(tenantId, transportFn, [item]);
        sincronizadas.push(...parcial.synced_ids);
        fallidas.push(...parcial.failed_ids);
        if (!parcial.success && parcial.message) {
          motivos.push(parcial.message);
        }
      }

      const unicos = Array.from(new Set(motivos));
      return {
        success: fallidas.length === 0,
        synced_ids: sincronizadas,
        failed_ids: fallidas,
        processed_at: new Date().toISOString(),
        message: fallidas.length === 0
          ? `Se sincronizaron ${sincronizadas.length} ventas`
          : `Se sincronizaron ${sincronizadas.length} de ${pending.length} ventas. ` +
            `${fallidas.length} quedaron pendientes: ${unicos.join(' | ')}`
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

      // La nube contesto y rechazo la venta por el dato mismo. Antes esto no gastaba intento,
      // de modo que la venta se reintentaba en cada sincronizacion indefinidamente y nadie
      // podia distinguirla de una que todavia tiene posibilidad de subir.
      const rechazadas = pending.filter((p) => !response.synced_ids.includes(p.sale.id));
      if (rechazadas.length > 0) {
        this.registrarRechazo(rechazadas);
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

  /**
   * Cuenta el intento de una venta que la nube rechazo por sus datos. Al agotar el tope la deja
   * detenida: sale del conjunto de pendientes y deja de contar como pendiente, porque afirmar
   * que esta por subir seria falso. Queda en FAILED con los intentos agotados, que es el estado
   * que la interfaz muestra para revision manual.
   */
  private registrarRechazo(items: SyncPushItem[]): void {
    this.sqlite.withTransaction(() => {
      for (const item of items) {
        const intentos = (item.sale.sync_attempts || 0) + 1;
        const detenida = intentos >= TOPE_REINTENTOS_VENTA;

        this.sqlite.execute(
          `UPDATE transacciones_venta
           SET sync_attempts = ?, sync_status = 'FAILED', is_dirty = ?
           WHERE id = ?`,
          [intentos, detenida ? 0 : 1, item.sale.id]
        );

        if (detenida) {
          logger.warn('PosSyncEngine', 'Venta detenida tras agotar los intentos: requiere revision manual', {
            ventaId: item.sale.id,
            folio: item.sale.folio_local_sqlite,
            intentos
          });
        }
      }
    });
  }

  /** Ventas que agotaron los intentos y ya no se reintentan. */
  public contarVentasDetenidas(tenantId: string): number {
    try {
      const fila = this.sqlite.queryOne<{ total: number }>(
        `SELECT COUNT(*) AS total FROM transacciones_venta
         WHERE tenant_id = ? AND sync_status = 'FAILED' AND COALESCE(sync_attempts, 0) >= ?`,
        [tenantId, TOPE_REINTENTOS_VENTA]
      );
      return Number(fila?.total) || 0;
    } catch {
      return 0;
    }
  }

  /**
   * Sube el catalogo del local para que la nube no dependa de que el producto se haya vendido.
   *
   * Se envia completo y el receptor decide: lo que ya existe arriba no se toca. A escala de un
   * minimarket el catalogo son decenas o cientos de filas, de modo que mandarlo entero en cada
   * sincronizacion cuesta menos que mantener de este lado una marca de que viajo, que seria otra
   * cosa mas que puede quedar desalineada con la realidad.
   */
  public async respaldarCatalogoEnNube(
    tenantId: string,
    transport?: (
      tenantId: string,
      productos: ProductoReferenciado[],
      proveedores: ProveedorReferenciado[]
    ) => Promise<RespaldoCatalogoResultado>
  ): Promise<RespaldoCatalogoResultado> {
    const enviar = transport
      || ((t: string, p: ProductoReferenciado[], v: ProveedorReferenciado[]) =>
            defaultCloudSyncReceiver.respaldarCatalogo(t, p, v));

    const productos = this.sqlite.query<ProductoReferenciado>(
      `SELECT id, sku, codigo_barra, nombre, precio_compra, precio_venta, proveedor_id,
              stock_actual, stock_minimo
       FROM productos WHERE tenant_id = ?`,
      [tenantId]
    );

    const proveedores = this.sqlite.query<ProveedorReferenciado>(
      'SELECT id, rut_proveedor, nombre_proveedores, email FROM proveedores WHERE tenant_id = ?',
      [tenantId]
    );

    return enviar(tenantId, productos, proveedores);
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

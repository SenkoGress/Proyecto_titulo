import { v4 as uuidv4 } from 'uuid';
import { PostgresClient, defaultPgClient } from '../database/postgres/client';
import { Producto } from '../database/types';
import { logger } from '../utils/logger';
import { defaultLotesService } from '../inventory/lotes.service';
import {
  ProductoReferenciado,
  ProveedorReferenciado,
  RespaldoCatalogoResultado,
  SyncPullResponse,
  SyncPushPayload,
  SyncPushResponse
} from './types';

/**
 * Id con que la nube conoce una fila que el terminal envia: la misma por id o, si entro por otro
 * camino, la que comparte su clave natural. Sin coincidencia devuelve el id enviado.
 */
async function idEnNube(
  db: { query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<{ id: string }> }> },
  tabla: 'productos' | 'proveedores',
  clave: 'sku' | 'rut_proveedor',
  tenantId: string,
  id: string,
  valor: string | null
): Promise<string> {
  const res = await db.query(
    `SELECT id FROM ${tabla} WHERE tenant_id = $1 AND (id = $2 OR ${clave} = $3)
     ORDER BY (id = $2) DESC LIMIT 1`,
    [tenantId, id, valor]
  );
  return res.rows[0]?.id ?? id;
}

export class CloudSyncReceiverService {
  private pgClient: PostgresClient;

  constructor(customPgClient?: PostgresClient) {
    this.pgClient = customPgClient || defaultPgClient;
  }

  public async ingestPushBatch(payload: SyncPushPayload): Promise<SyncPushResponse> {
    const consumosDeLote: Array<{ productoId: string; cantidad: number }> = [];
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
          const { sale, details, productos, proveedores } = item;

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

            // El terminal y la nube pueden tener el mismo proveedor (por RUT) o el mismo producto
            // (por SKU) con distinto id: uno entro por factura y el otro lo sembro el catalogo. Se
            // reconocen por cualquiera de sus claves unicas y se usa el id que tiene la nube.
            // El proveedor va antes que el producto: el producto lo referencia
            const proveedorEnNube = new Map<string, string>();
            for (const proveedor of proveedores || []) {
              await client.query(
                `INSERT INTO proveedores
                 (id, tenant_id, rut_proveedor, nombre_proveedores, email, origen_creacion)
                 VALUES ($1, $2, $3, $4, $5, 'SINCRONIZACION')
                 ON CONFLICT DO NOTHING`,
                [proveedor.id, payload.tenant_id, proveedor.rut_proveedor,
                 proveedor.nombre_proveedores, proveedor.email]
              );
              proveedorEnNube.set(proveedor.id, await idEnNube(client, 'proveedores', 'rut_proveedor',
                payload.tenant_id, proveedor.id, proveedor.rut_proveedor));
            }

            // Registrar primero los productos que la nube no conoce: un producto creado en el
            // terminal y nunca replicado impedia sincronizar la venta que lo referenciaba, y esa
            // venta quedaba atascada sin forma de avanzar desde la caja.
            const productoEnNube = new Map<string, string>();
            for (const producto of productos || []) {
              await client.query(
                `INSERT INTO productos
                 (id, tenant_id, proveedor_id, sku, codigo_barra, nombre, stock_actual,
                  stock_minimo, precio_compra, precio_venta, activo, origen_creacion)
                 VALUES ($1, $2, $8, $3, $4, $5, 0, 0, $6, $7, true, 'SINCRONIZACION')
                 ON CONFLICT DO NOTHING`,
                [
                  producto.id,
                  payload.tenant_id,
                  producto.sku,
                  producto.codigo_barra,
                  producto.nombre,
                  producto.precio_compra,
                  producto.precio_venta,
                  (producto.proveedor_id && proveedorEnNube.get(producto.proveedor_id)) || producto.proveedor_id
                ]
              );
              productoEnNube.set(producto.id, await idEnNube(client, 'productos', 'sku',
                payload.tenant_id, producto.id, producto.sku));
            }

            // 3. Procesar detalles e implementar Resolución de Conflicto de Stock por Delta Neto
            for (const detail of details) {
              const productoId = productoEnNube.get(detail.producto_id) ?? detail.producto_id;
              await client.query(
                `INSERT INTO detalle_venta (id, venta_id, producto_id, cantidad, precio_unitario, subtotal)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (id) DO NOTHING`,
                [
                  detail.id || uuidv4(),
                  sale.id,
                  productoId,
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
                [productoId, payload.tenant_id]
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
                  [newCloudStock, productoId, payload.tenant_id]
                );

                // Registrar auditoría en historial_stock
                await client.query(
                  `INSERT INTO historial_stock 
                   (id, tenant_id, producto_id, cambio_anterior, nuevo_stock, cambio, tipo_movimiento, motivo, usuario_registro)
                   VALUES ($1, $2, $3, $4, $5, $6, 'venta', $7, 'POS Offline-First Sync')`,
                  [
                    uuidv4(),
                    payload.tenant_id,
                    productoId,
                    currentCloudStock,
                    newCloudStock,
                    delta,
                    `Sincronización venta offline folio: ${sale.folio_local_sqlite || sale.id}`
                  ]
                );

                // El descuento por lote se acumula y se aplica una vez confirmada la venta:
                // la contabilidad de lotes no puede hacer fracasar la sincronizacion
                consumosDeLote.push({
                  productoId: productoId,
                  cantidad: Math.abs(delta)
                });

                // Registrar auditoría en movimientos_inventario
                await client.query(
                  `INSERT INTO movimientos_inventario 
                   (id, tenant_id, producto_id, tipo_movimiento_id, cantidad, saldo_anterior, nuevo_saldo, id_origen, tipo_origen, usuario_registro)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'VENTA_POS', 'POS Sync')`,
                  [
                    uuidv4(),
                    payload.tenant_id,
                    productoId,
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

      // Fuera de la transaccion y a prueba de fallos: la venta ya quedo registrada
      await defaultLotesService.consumirFefoEnNube(payload.tenant_id, consumosDeLote);

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

  /**
   * Recibe el catalogo del terminal y guarda lo que la nube no tiene.
   *
   * La operacion es estrictamente aditiva: una fila que ya existe arriba no se toca. El motivo
   * es la politica de catalogo, donde la nube manda sobre precios y nombres y el terminal los
   * recibe en la bajada. Sobrescribir aqui pelearia con esa bajada. Lo que esto resuelve es
   * distinto: que no quede mercaderia registrada unicamente en el equipo del local.
   *
   * El stock viaja solo en la fila nueva. En las existentes lo mantiene la sincronizacion de
   * ventas, y escribirlo de nuevo descuadraria la cuenta de la nube.
   */
  public async respaldarCatalogo(
    tenantId: string,
    productos: ProductoReferenciado[],
    proveedores: ProveedorReferenciado[]
  ): Promise<RespaldoCatalogoResultado> {
    if (!this.pgClient.isCloudAvailable()) {
      return {
        success: false,
        productos_nuevos: 0,
        proveedores_nuevos: 0,
        message: 'El servidor en la nube no esta disponible: el catalogo se respalda al reconectar.'
      };
    }

    let productosNuevos = 0;
    let proveedoresNuevos = 0;

    try {
      // El proveedor va antes que el producto, que lo referencia por clave foranea
      const proveedorEnNube = new Map<string, string>();
      for (const proveedor of proveedores) {
        const res = await this.pgClient.query(
          `INSERT INTO proveedores
           (id, tenant_id, rut_proveedor, nombre_proveedores, email, origen_creacion)
           VALUES ($1, $2, $3, $4, $5, 'SINCRONIZACION')
           ON CONFLICT DO NOTHING`,
          [proveedor.id, tenantId, proveedor.rut_proveedor, proveedor.nombre_proveedores, proveedor.email]
        );
        proveedoresNuevos += res.rowCount || 0;
        proveedorEnNube.set(proveedor.id, await idEnNube(this.pgClient, 'proveedores', 'rut_proveedor',
          tenantId, proveedor.id, proveedor.rut_proveedor));
      }

      for (const producto of productos) {
        const res = await this.pgClient.query(
          `INSERT INTO productos
           (id, tenant_id, proveedor_id, sku, codigo_barra, nombre, stock_actual,
            stock_minimo, precio_compra, precio_venta, activo, origen_creacion)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'SINCRONIZACION')
           ON CONFLICT DO NOTHING`,
          [
            producto.id,
            tenantId,
            (producto.proveedor_id && proveedorEnNube.get(producto.proveedor_id)) || producto.proveedor_id,
            producto.sku,
            producto.codigo_barra,
            producto.nombre,
            producto.stock_actual ?? 0,
            producto.stock_minimo ?? 0,
            producto.precio_compra,
            producto.precio_venta,
            producto.activo === undefined ? true : Boolean(producto.activo)
          ]
        );
        productosNuevos += res.rowCount || 0;
      }

      if (productosNuevos > 0 || proveedoresNuevos > 0) {
        logger.info('CloudSyncReceiver', 'Catalogo respaldado en la nube', {
          productosNuevos,
          proveedoresNuevos
        });
      }

      return {
        success: true,
        productos_nuevos: productosNuevos,
        proveedores_nuevos: proveedoresNuevos,
        message: productosNuevos + proveedoresNuevos === 0
          ? 'La nube ya tiene todo el catalogo del local.'
          : `Respaldados ${productosNuevos} productos y ${proveedoresNuevos} proveedores que la nube no tenia.`
      };
    } catch (error) {
      const detalle = error instanceof Error ? error.message : String(error);
      logger.warn('CloudSyncReceiver', 'El respaldo del catalogo no pudo completarse', { error: detalle });
      return {
        success: false,
        productos_nuevos: productosNuevos,
        proveedores_nuevos: proveedoresNuevos,
        message: `El respaldo del catalogo quedo incompleto: ${detalle}`
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
      const idsProveedor = Array.from(new Set(result.rows.map((p) => p.proveedor_id).filter(Boolean)));
      const proveedores = idsProveedor.length === 0 ? [] : (await this.pgClient.query<ProveedorReferenciado>(
        `SELECT id, rut_proveedor, nombre_proveedores, email FROM proveedores
         WHERE tenant_id = $1 AND id IN (${idsProveedor.map((_, i) => `$${i + 2}`).join(', ')})`,
        [tenantId, ...idsProveedor]
      )).rows;

      return {
        success: true,
        products: result.rows,
        proveedores,
        server_timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('CloudSyncReceiver', 'Failed to retrieve catalog pull updates', error, { tenantId });
      throw error;
    }
  }
}

export const defaultCloudSyncReceiver = new CloudSyncReceiverService();

import { v4 as uuidv4 } from 'uuid';
import { defaultSqliteClient, SqliteClient } from '../database/sqlite/client';
import { logger } from '../utils/logger';

export interface Lote {
  id: string;
  tenant_id: string;
  producto_id: string;
  codigo_lote: string | null;
  cantidad: number;
  fecha_vencimiento: string;
  factura_origen_folio: string | null;
  origen: string;
}

export interface ConsumoLote {
  lote_id: string;
  fecha_vencimiento: string;
  cantidad: number;
}

export interface ResultadoConsumo {
  consumido: number;
  /** Lo que el stock vendio y ningun lote respaldaba. No bloquea la operacion. */
  sinRespaldo: number;
  detalle: ConsumoLote[];
}

/**
 * Existencia por lote para el control de vencimientos del D.S. 977/96.
 *
 * Regla de diseno que no se negocia: el stock del producto es la verdad y los lotes son una
 * capa contable sobre el. Si ambos discrepan, la venta se registra igual y la diferencia se
 * informa como `sinRespaldo`. Una caja no puede dejar de vender porque un lote no cuadre.
 */
export class LotesService {
  constructor(private readonly sqlite: SqliteClient = defaultSqliteClient) {}

  private get disponible(): boolean {
    return Boolean(
      this.sqlite.queryOne<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='lotes'"
      )
    );
  }

  public registrar(
    tenantId: string,
    productoId: string,
    cantidad: number,
    fechaVencimiento: string | null | undefined,
    codigoLote?: string | null,
    folio?: string | null,
    origen = 'INGESTA'
  ): Lote | null {
    if (!fechaVencimiento || Number(cantidad) <= 0 || !this.disponible) return null;

    const id = uuidv4();
    this.sqlite.execute(
      `INSERT INTO lotes (id, tenant_id, producto_id, codigo_lote, cantidad, fecha_vencimiento, factura_origen_folio, origen)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, tenantId, productoId, codigoLote ?? null, Number(cantidad), fechaVencimiento, folio ?? null, origen]
    );

    this.sincronizarFechaProducto(productoId);

    return {
      id,
      tenant_id: tenantId,
      producto_id: productoId,
      codigo_lote: codigoLote ?? null,
      cantidad: Number(cantidad),
      fecha_vencimiento: fechaVencimiento,
      factura_origen_folio: folio ?? null,
      origen
    };
  }

  /**
   * Descuenta primero lo que vence antes. Nunca lanza: si los lotes no alcanzan, informa el
   * faltante y deja que la venta continue.
   */
  public consumirFefo(tenantId: string, productoId: string, cantidad: number): ResultadoConsumo {
    const pedido = Number(cantidad);
    const vacio: ResultadoConsumo = { consumido: 0, sinRespaldo: pedido, detalle: [] };

    if (pedido <= 0 || !this.disponible) return { ...vacio, sinRespaldo: 0 };

    try {
      const lotes = this.sqlite.query<{ id: string; cantidad: number; fecha_vencimiento: string }>(
        `SELECT id, cantidad, fecha_vencimiento FROM lotes
         WHERE tenant_id = ? AND producto_id = ? AND cantidad > 0
         ORDER BY fecha_vencimiento ASC, created_at ASC`,
        [tenantId, productoId]
      );

      let restante = pedido;
      const detalle: ConsumoLote[] = [];

      for (const lote of lotes) {
        if (restante <= 0) break;
        const disponible = Number(lote.cantidad);
        const toma = Math.min(disponible, restante);

        this.sqlite.execute(
          "UPDATE lotes SET cantidad = cantidad - ?, updated_at = datetime('now') WHERE id = ?",
          [toma, lote.id]
        );

        detalle.push({ lote_id: lote.id, fecha_vencimiento: lote.fecha_vencimiento, cantidad: toma });
        restante -= toma;
      }

      this.sincronizarFechaProducto(productoId);

      return { consumido: pedido - restante, sinRespaldo: restante, detalle };
    } catch (error) {
      // La contabilidad de lotes jamas interrumpe una venta ni una merma
      logger.warn('LotesService', 'No fue posible descontar por lote; la operacion continua', {
        productoId,
        error: error instanceof Error ? error.message : String(error)
      });
      return vacio;
    }
  }

  /**
   * `productos.fecha_vencimiento` queda como copia del lote vivo mas proximo, para que la
   * interfaz y las consultas existentes sigan funcionando sin cambios.
   */
  public sincronizarFechaProducto(productoId: string): void {
    if (!this.disponible) return;

    try {
      const fila = this.sqlite.queryOne<{ proxima: string | null }>(
        'SELECT MIN(fecha_vencimiento) AS proxima FROM lotes WHERE producto_id = ? AND cantidad > 0',
        [productoId]
      );

      if (fila?.proxima) {
        this.sqlite.execute('UPDATE productos SET fecha_vencimiento = ? WHERE id = ?', [fila.proxima, productoId]);
      }
      // Sin lotes vivos no se borra la fecha del producto: puede haber existencia anterior a
      // esta migracion que ningun lote respalda, y borrarla apagaria la alerta de vencimiento.
    } catch (error) {
      logger.warn('LotesService', 'No fue posible sincronizar la fecha del producto', {
        productoId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  public lotesDe(tenantId: string, productoId: string): Lote[] {
    if (!this.disponible) return [];
    return this.sqlite.query<Lote>(
      `SELECT * FROM lotes WHERE tenant_id = ? AND producto_id = ? AND cantidad > 0
       ORDER BY fecha_vencimiento ASC`,
      [tenantId, productoId]
    );
  }

  /** Unidades con vencimiento vivo por producto, para enriquecer el panel de vencimientos. */
  public unidadesPorProducto(tenantId: string): Map<string, number> {
    const mapa = new Map<string, number>();
    if (!this.disponible) return mapa;

    const filas = this.sqlite.query<{ producto_id: string; unidades: number }>(
      `SELECT producto_id, SUM(cantidad) AS unidades FROM lotes
       WHERE tenant_id = ? AND cantidad > 0 GROUP BY producto_id`,
      [tenantId]
    );
    for (const f of filas) mapa.set(f.producto_id, Number(f.unidades));
    return mapa;
  }
}

export const defaultLotesService = new LotesService();

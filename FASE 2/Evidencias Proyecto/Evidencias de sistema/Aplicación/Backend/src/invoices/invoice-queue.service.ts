import { v4 as uuidv4 } from 'uuid';
import { defaultSqliteClient, SqliteClient } from '../database/sqlite/client';
import { logger } from '../utils/logger';
import { esDocumentoIlegible } from '../ocr/extraccion';
import { DocumentoFactura, InvoiceFileStore, defaultInvoiceFileStore } from './invoice-file.store';
import { InvoiceIngestionService, defaultInvoiceIngestionService } from './invoice-ingestion.service';

import { ESTADO_PENDIENTE, ESTADO_FALLIDA, ESTADO_POR_REVISAR, ticketsEnConfirmacion } from './estados-cola';
import { ScannedInvoicePreview } from './invoice-ingestion.service';
import { ExtractedInvoiceData } from '../ocr/types';

export { ESTADO_PENDIENTE, ESTADO_FALLIDA, ESTADO_POR_REVISAR };

export interface FacturaEnCola {
  id: string;
  tenant_id: string;
  numero_factura: string;
  estado: string;
  archivo_nombre: string | null;
  archivo_mime: string | null;
  sync_attempts: number;
  ultimo_error: string | null;
  created_at: string;
}

export interface ResultadoCola {
  /** Leidas en esta pasada: quedan esperando que una persona declare los vencimientos. */
  por_revisar: number;
  fallidas: number;
  pendientes: number;
  detalle: Array<{ id: string; estado: string; folio?: string; error?: string }>;
}

/**
 * Cola de facturas que no se pudieron digitalizar en el momento (RF-43).
 *
 * El documento se guarda en disco y la factura queda registrada en estado PENDIENTE_OCR
 * para reintentarla al recuperar la conexión. Tras agotar los intentos pasa a FALLIDA_OCR
 * y deja de reintentarse: una foto ilegible no mejora por insistir, y lo que corresponde es
 * que el usuario la ingrese a mano.
 *
 * La cola vive en el nodo local (SQLite), que es donde importa la ausencia de red.
 */

/**
 * Distingue el fallo del servicio externo del fallo del documento. El primero se resuelve solo
 * cuando el servicio vuelve; el segundo no mejora por insistir.
 */
export function esFalloDelServicio(error: unknown): boolean {
  const mensaje = (error instanceof Error ? error.message : String(error)).toLowerCase();
  const senales = [
    'no fue posible digitalizar',
    'enotfound',
    'econnrefused',
    'econnreset',
    'etimedout',
    'timeout',
    'socket hang up',
    'network',
    'rate limit',
    '429',
    '503',
    'service unavailable',
    'api key'
  ];
  return senales.some((s) => mensaje.includes(s));
}

export class InvoiceQueueService {
  private readonly sqlite: SqliteClient;
  private readonly store: InvoiceFileStore;
  private readonly ingestion: InvoiceIngestionService;
  private readonly maxIntentos: number;

  constructor(sqlite?: SqliteClient, store?: InvoiceFileStore, ingestion?: InvoiceIngestionService, maxIntentos?: number) {
    this.sqlite = sqlite || defaultSqliteClient;
    this.store = store || defaultInvoiceFileStore;
    this.ingestion = ingestion || defaultInvoiceIngestionService;
    const n = Number(maxIntentos ?? process.env.INVOICE_MAX_OCR_ATTEMPTS ?? 3);
    this.maxIntentos = Number.isFinite(n) && n > 0 ? n : 3;
  }

  public get intentosMaximos(): number {
    return this.maxIntentos;
  }

  /**
   * Guarda el documento y lo registra como pendiente. El folio real se desconoce hasta
   * digitalizarlo, así que se usa un identificador provisional visible para el usuario.
   */
  public encolar(
    tenantId: string,
    contenido: string | Buffer,
    fileName?: string,
    mimeType?: string,
    motivo?: string
  ): { id: string; archivo_nombre: string; numero_factura: string } {
    const archivo = this.store.guardar(tenantId, contenido, fileName, mimeType);
    const id = uuidv4();
    const numeroProvisional = `PENDIENTE-${id.slice(0, 8).toUpperCase()}`;

    this.sqlite.execute(
      `INSERT INTO factura_ingresos
         (id, tenant_id, numero_factura, fecha_ingreso, estado, cantidad, metodo_ingreso, total,
          archivo_ruta, archivo_nombre, archivo_mime, ultimo_error, is_dirty, sync_attempts, sync_status)
       VALUES (?, ?, ?, date('now'), ?, 0, 'COLA_OFFLINE', 0, ?, ?, ?, ?, 1, 0, ?)`,
      [id, tenantId, numeroProvisional, ESTADO_PENDIENTE, archivo.ruta, archivo.nombre, archivo.mime,
       motivo || null, ESTADO_PENDIENTE]
    );

    logger.info('InvoiceQueueService', `Factura encolada para reintento posterior: ${numeroProvisional}`, {
      tenantId,
      archivo: archivo.nombre,
      bytes: archivo.bytes
    });

    return { id, archivo_nombre: archivo.nombre, numero_factura: numeroProvisional };
  }

  /**
   * Registra un documento que el motor leyó y resultó ilegible. No entra como pendiente porque
   * reintentarlo daría el mismo resultado: queda visible como fallido para que el usuario saque
   * otra fotografía o la ingrese a mano, y el archivo se conserva mientras decide.
   */
  public registrarIlegible(
    tenantId: string,
    contenido: string | Buffer,
    fileName?: string,
    mimeType?: string,
    motivo?: string
  ): { id: string; archivo_nombre: string; numero_factura: string } {
    const archivo = this.store.guardar(tenantId, contenido, fileName, mimeType);
    const id = uuidv4();
    const numeroProvisional = `ILEGIBLE-${id.slice(0, 8).toUpperCase()}`;

    this.sqlite.execute(
      `INSERT INTO factura_ingresos
         (id, tenant_id, numero_factura, fecha_ingreso, estado, cantidad, metodo_ingreso, total,
          archivo_ruta, archivo_nombre, archivo_mime, ultimo_error, is_dirty, sync_attempts, sync_status, procesado_at)
       VALUES (?, ?, ?, date('now'), ?, 0, 'OCR_ILEGIBLE', 0, ?, ?, ?, ?, 0, ?, ?, datetime('now'))`,
      [id, tenantId, numeroProvisional, ESTADO_FALLIDA, archivo.ruta, archivo.nombre, archivo.mime,
       motivo || null, this.maxIntentos, ESTADO_FALLIDA]
    );

    logger.warn('InvoiceQueueService', `Documento ilegible registrado sin reintentos: ${numeroProvisional}`, {
      tenantId,
      archivo: archivo.nombre
    });

    return { id, archivo_nombre: archivo.nombre, numero_factura: numeroProvisional };
  }

  public listar(tenantId: string, incluirFallidas = true): FacturaEnCola[] {
    const estados = incluirFallidas
      ? [ESTADO_POR_REVISAR, ESTADO_PENDIENTE, ESTADO_FALLIDA]
      : [ESTADO_POR_REVISAR, ESTADO_PENDIENTE];
    const marcadores = estados.map(() => '?').join(', ');
    return this.sqlite.query<FacturaEnCola>(
      `SELECT id, tenant_id, numero_factura, estado, archivo_nombre, archivo_mime,
              sync_attempts, ultimo_error, created_at
         FROM factura_ingresos
        WHERE tenant_id = ? AND estado IN (${marcadores})
        ORDER BY created_at ASC`,
      [tenantId, ...estados]
    );
  }

  public contarPendientes(tenantId: string): number {
    const fila = this.sqlite.queryOne<{ total: number }>(
      `SELECT COUNT(*) as total FROM factura_ingresos WHERE tenant_id = ? AND estado = ?`,
      [tenantId, ESTADO_PENDIENTE]
    );
    return Number(fila?.total ?? 0);
  }

  /**
   * Reintenta la lectura de las facturas pendientes. La cola no ingresa nada por su cuenta: una
   * factura entra al stock solo cuando una persona declaro el vencimiento de cada producto, asi
   * que lo leido queda guardado en estado POR_REVISAR hasta que alguien la abra y la confirme.
   */
  public async procesarPendientes(tenantId: string): Promise<ResultadoCola> {
    const pendientes = this.sqlite.query<FacturaEnCola & { archivo_ruta: string | null }>(
      `SELECT id, numero_factura, archivo_ruta, archivo_nombre, archivo_mime, sync_attempts
         FROM factura_ingresos
        WHERE tenant_id = ? AND estado = ? AND sync_attempts < ?
        ORDER BY created_at ASC`,
      [tenantId, ESTADO_PENDIENTE, this.maxIntentos]
    );

    const resultado: ResultadoCola = { por_revisar: 0, fallidas: 0, pendientes: 0, detalle: [] };

    for (const factura of pendientes) {
      if (!factura.archivo_ruta || !this.store.existe(factura.archivo_ruta)) {
        this.marcarFallida(factura.id, 'El documento almacenado no está disponible en disco');
        resultado.fallidas += 1;
        resultado.detalle.push({ id: factura.id, estado: ESTADO_FALLIDA, error: 'documento no disponible' });
        continue;
      }

      const intentos = Number(factura.sync_attempts ?? 0) + 1;

      try {
        const base64 = this.store.leerBase64(factura.archivo_ruta);
        // Se reenvia el documento ya almacenado para que la lectura no guarde una segunda copia
        const leida = await this.ingestion.scanInvoice(
          tenantId,
          {
            invoiceData: base64,
            fileName: factura.archivo_nombre || undefined,
            mimeType: factura.archivo_mime || undefined
          },
          {
            ruta: factura.archivo_ruta,
            nombre: factura.archivo_nombre || 'factura',
            mime: factura.archivo_mime || 'application/octet-stream'
          }
        );

        if (leida.items.length === 0) {
          if (!this.marcarFallida(factura.id, 'La lectura no encontro productos en el documento', intentos)) continue;
          resultado.fallidas += 1;
          resultado.detalle.push({ id: factura.id, estado: ESTADO_FALLIDA, error: 'sin productos' });
          continue;
        }

        // Se guarda solo lo leido: el stock y los precios se recalculan al abrir la factura. El
        // numero provisional no se cambia, para que la factura real no choque con su propio ticket.
        const guardada = this.sqlite.execute(
          `UPDATE factura_ingresos
              SET estado = ?, sync_status = ?, json_ocr_raw = ?, metodo_ingreso = ?, ultimo_error = NULL,
                  sync_attempts = ?, procesado_at = datetime('now')
            WHERE id = ? AND estado = ?`,
          [ESTADO_POR_REVISAR, ESTADO_POR_REVISAR, JSON.stringify(leida.raw_data), leida.ocr_provider, intentos, factura.id, ESTADO_PENDIENTE]
        );
        // otra pasada ya resolvio este ticket: no se cuenta dos veces
        if (!Number(guardada.changes)) continue;
        resultado.por_revisar += 1;
        resultado.detalle.push({ id: factura.id, estado: ESTADO_POR_REVISAR, folio: leida.folio_factura });
        logger.info('InvoiceQueueService', `Factura de la cola leida en el intento ${intentos}: espera revision`, { id: factura.id });
      } catch (error) {
        const mensaje = error instanceof Error ? error.message : String(error);

        // El motor leyó el documento y no sirve: insistir no lo mejora
        if (esDocumentoIlegible(error)) {
          if (!this.marcarFallida(factura.id, mensaje, intentos)) continue;
          resultado.fallidas += 1;
          resultado.detalle.push({ id: factura.id, estado: ESTADO_FALLIDA, error: mensaje });
          logger.warn('InvoiceQueueService', 'Factura retirada de la cola por documento ilegible', { id: factura.id });
          continue;
        }

        // Un intento se gasta cuando el sistema hizo su parte y el resultado no sirvio. Que el
        // servicio de reconocimiento no responda no es merito ni culpa del documento: contarlo
        // como intento terminaba marcando FALLIDA_OCR una factura perfectamente legible, solo
        // porque el servicio estuvo caido tres veces seguidas.
        const fueElServicio = esFalloDelServicio(error);

        if (!fueElServicio && intentos >= this.maxIntentos) {
          if (!this.marcarFallida(factura.id, mensaje, intentos)) continue;
          resultado.fallidas += 1;
          resultado.detalle.push({ id: factura.id, estado: ESTADO_FALLIDA, error: mensaje });
        } else {
          const intentosRegistrados = fueElServicio ? Number(factura.sync_attempts ?? 0) : intentos;
          const anotada = this.sqlite.execute(
            'UPDATE factura_ingresos SET sync_attempts = ?, ultimo_error = ? WHERE id = ? AND estado = ?',
            [intentosRegistrados, mensaje, factura.id, ESTADO_PENDIENTE]
          );
          if (!Number(anotada.changes)) continue;
          resultado.pendientes += 1;
          resultado.detalle.push({ id: factura.id, estado: ESTADO_PENDIENTE, error: mensaje });
        }

        logger.warn(
          'InvoiceQueueService',
          fueElServicio
            ? 'El servicio de reconocimiento no respondio: la factura sigue en cola y no gasta intento'
            : `Reintento ${intentos} de ${this.maxIntentos} sin exito`,
          { id: factura.id, error: mensaje }
        );
      }
    }

    resultado.pendientes = this.contarPendientes(tenantId);
    return resultado;
  }

  private ticketPorRevisar(tenantId: string, id: string) {
    return this.sqlite.queryOne<{
      archivo_ruta: string | null; archivo_nombre: string | null; archivo_mime: string | null;
      json_ocr_raw: string | null; metodo_ingreso: string | null;
    }>(
      `SELECT archivo_ruta, archivo_nombre, archivo_mime, json_ocr_raw, metodo_ingreso
         FROM factura_ingresos WHERE id = ? AND tenant_id = ? AND estado = ?`,
      [id, tenantId, ESTADO_POR_REVISAR]
    );
  }

  /** Documento del ticket: al confirmar se usa este, no el que diga el cliente. */
  public documentoDelTicket(tenantId: string, id: string): DocumentoFactura | null {
    const ticket = this.ticketPorRevisar(tenantId, id);
    if (!ticket || !ticket.archivo_ruta) return null;
    return {
      ruta: ticket.archivo_ruta,
      nombre: ticket.archivo_nombre || 'factura',
      mime: ticket.archivo_mime || 'application/octet-stream'
    };
  }

  /** Vista previa de una factura leida por la cola, cruzada con el inventario de este momento. */
  public async abrirParaRevision(tenantId: string, id: string): Promise<ScannedInvoicePreview | null> {
    const ticket = this.ticketPorRevisar(tenantId, id);
    if (!ticket || !ticket.json_ocr_raw) return null;
    return this.ingestion.armarVistaPrevia(
      tenantId,
      JSON.parse(ticket.json_ocr_raw) as ExtractedInvoiceData,
      ticket.metodo_ingreso || 'COLA_OFFLINE',
      this.documentoDelTicket(tenantId, id) || undefined
    );
  }

  /**
   * Retira una factura leida que no se va a ingresar, por ejemplo porque ya estaba ingresada. El
   * documento queda sin referencia y lo elimina la limpieza de huerfanos.
   */
  public descartar(tenantId: string, id: string): boolean {
    if (ticketsEnConfirmacion.has(id)) return false;
    const resultado = this.sqlite.execute(
      'DELETE FROM factura_ingresos WHERE id = ? AND tenant_id = ? AND estado = ?',
      [id, tenantId, ESTADO_POR_REVISAR]
    );
    return Number(resultado.changes) > 0;
  }

  /**
   * Elimina documentos que ninguna factura referencia, lo que ocurre cuando se escanea y no se
   * confirma. Se respeta un margen de horas para no borrar un escaneo que el usuario aún está
   * revisando en pantalla.
   */
  public limpiarHuerfanos(tenantId: string, horasMinimas = 24): number {
    const referenciadas = new Set(
      this.sqlite
        .query<{ archivo_ruta: string }>(
          'SELECT archivo_ruta FROM factura_ingresos WHERE tenant_id = ? AND archivo_ruta IS NOT NULL',
          [tenantId]
        )
        .map((f) => f.archivo_ruta)
    );

    let eliminados = 0;
    for (const ruta of this.store.inventariar(tenantId)) {
      if (referenciadas.has(ruta)) continue;
      if (this.store.antiguedadHoras(ruta) < horasMinimas) continue;
      this.store.eliminar(ruta);
      eliminados += 1;
    }

    if (eliminados > 0) {
      logger.info('InvoiceQueueService', `Documentos sin factura asociada eliminados: ${eliminados}`, { tenantId });
    }
    return eliminados;
  }

  // Solo un ticket que sigue pendiente: dos pasadas a la vez no deben sacar de revision uno ya leido
  private marcarFallida(id: string, motivo: string, intentos?: number): boolean {
    const resultado = this.sqlite.execute(
      `UPDATE factura_ingresos
          SET estado = ?, sync_status = ?, is_dirty = 0, ultimo_error = ?, sync_attempts = ?, procesado_at = datetime('now')
        WHERE id = ? AND estado = ?`,
      [ESTADO_FALLIDA, ESTADO_FALLIDA, motivo, intentos ?? this.maxIntentos, id, ESTADO_PENDIENTE]
    );
    return Number(resultado.changes) > 0;
  }
}

export const defaultInvoiceQueue = new InvoiceQueueService();

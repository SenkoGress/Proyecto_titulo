import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

/** Referencia minima al documento almacenado, para vincularlo al registro de la factura. */
export interface DocumentoFactura {
  ruta: string;
  nombre: string;
  mime: string;
}

export interface StoredInvoiceFile {
  ruta: string; // relativa al directorio base, para que el respaldo sea portable
  nombre: string;
  mime: string;
  bytes: number;
}

const EXTENSIONES_PERMITIDAS: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp'
};

const MIME_POR_EXTENSION: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp'
};

/**
 * Guarda en disco el documento subido para que una factura que no se pudo digitalizar
 * quede reprocesable. Antes de esto el archivo entraba, se procesaba y se descartaba, de
 * modo que al volver la conexión no había nada que reintentar.
 */
export class InvoiceFileStore {
  private readonly baseDir: string;
  private readonly maxBytes: number;

  constructor(baseDir?: string, maxMb?: number) {
    this.baseDir = baseDir || process.env.INVOICE_STORAGE_DIR || path.resolve(process.cwd(), 'data', 'facturas');
    const mb = Number(maxMb ?? process.env.INVOICE_MAX_FILE_MB ?? 10);
    this.maxBytes = (Number.isFinite(mb) && mb > 0 ? mb : 10) * 1024 * 1024;
  }

  private resolverExtension(fileName?: string, mimeType?: string): string {
    if (mimeType && EXTENSIONES_PERMITIDAS[mimeType.toLowerCase()]) {
      return EXTENSIONES_PERMITIDAS[mimeType.toLowerCase()];
    }
    const ext = fileName ? path.extname(fileName).toLowerCase() : '';
    return MIME_POR_EXTENSION[ext] ? ext : '.bin';
  }

  private resolverMime(extension: string, mimeType?: string): string {
    if (mimeType && EXTENSIONES_PERMITIDAS[mimeType.toLowerCase()]) return mimeType.toLowerCase();
    return MIME_POR_EXTENSION[extension] || 'application/octet-stream';
  }

  private aBuffer(contenido: string | Buffer): Buffer {
    if (Buffer.isBuffer(contenido)) return contenido;
    // El cliente puede enviar el base64 crudo o como data URL
    const limpio = contenido.includes(',') && contenido.trimStart().startsWith('data:')
      ? contenido.slice(contenido.indexOf(',') + 1)
      : contenido;
    return Buffer.from(limpio, 'base64');
  }

  public guardar(tenantId: string, contenido: string | Buffer, fileName?: string, mimeType?: string): StoredInvoiceFile {
    const buffer = this.aBuffer(contenido);
    if (buffer.length === 0) {
      throw new Error('El documento recibido está vacío o no es base64 válido');
    }
    if (buffer.length > this.maxBytes) {
      throw new Error(`El documento supera el máximo permitido de ${Math.round(this.maxBytes / 1024 / 1024)} MB`);
    }

    const extension = this.resolverExtension(fileName, mimeType);
    const relativa = path.join(tenantId, `${uuidv4()}${extension}`);
    const absoluta = path.join(this.baseDir, relativa);

    fs.mkdirSync(path.dirname(absoluta), { recursive: true });
    fs.writeFileSync(absoluta, buffer);

    return {
      ruta: relativa.split(path.sep).join('/'),
      nombre: fileName || `factura${extension}`,
      mime: this.resolverMime(extension, mimeType),
      bytes: buffer.length
    };
  }

  /** Devuelve el documento en base64 para volver a pasarlo por el OCR. */
  public leerBase64(rutaRelativa: string): string {
    const absoluta = path.join(this.baseDir, rutaRelativa);
    return fs.readFileSync(absoluta).toString('base64');
  }

  public leerBuffer(rutaRelativa: string): Buffer {
    return fs.readFileSync(path.join(this.baseDir, rutaRelativa));
  }

  public existe(rutaRelativa: string): boolean {
    try {
      return fs.existsSync(path.join(this.baseDir, rutaRelativa));
    } catch {
      return false;
    }
  }

  public eliminar(rutaRelativa: string): void {
    try {
      fs.unlinkSync(path.join(this.baseDir, rutaRelativa));
    } catch (err) {
      logger.warn('InvoiceFileStore', 'No se pudo eliminar el documento almacenado', { ruta: rutaRelativa, error: String(err) });
    }
  }

  /** Rutas relativas de los documentos de un comercio, para cruzarlas con la base. */
  public inventariar(tenantId: string): string[] {
    const dir = path.join(this.baseDir, tenantId);
    try {
      return fs.readdirSync(dir).map((nombre) => `${tenantId}/${nombre}`);
    } catch {
      return [];
    }
  }

  public antiguedadHoras(rutaRelativa: string): number {
    try {
      const stat = fs.statSync(path.join(this.baseDir, rutaRelativa));
      return (Date.now() - stat.mtimeMs) / 3_600_000;
    } catch {
      return 0;
    }
  }

  public get directorioBase(): string {
    return this.baseDir;
  }
}

export const defaultInvoiceFileStore = new InvoiceFileStore();

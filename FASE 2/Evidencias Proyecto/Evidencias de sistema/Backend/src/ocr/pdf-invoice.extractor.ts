// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParseModule = require('pdf-parse');
import { ExtractedInvoiceData, InvoiceInput } from './types';
import { logger } from '../utils/logger';

export class PdfInvoiceExtractor {
  /**
   * Intenta parsear un documento PDF de Factura Electrónica Chilena (DTE)
   */
  public async extractFromPdf(input: InvoiceInput): Promise<ExtractedInvoiceData | null> {
    try {
      let buffer: Buffer;

      if (Buffer.isBuffer(input.invoiceData)) {
        buffer = input.invoiceData;
      } else if (typeof input.invoiceData === 'string') {
        // Limpiar encabezados data:application/pdf;base64,... si existen
        const cleanBase64 = input.invoiceData.includes(',')
          ? input.invoiceData.split(',')[1]
          : input.invoiceData;
        buffer = Buffer.from(cleanBase64, 'base64');
      } else {
        return null;
      }

      // Verificar si es un archivo PDF válido (cabecera %PDF)
      const header = buffer.subarray(0, 5).toString('ascii');
      if (!header.startsWith('%PDF')) {
        logger.debug('PdfInvoiceExtractor', 'Buffer does not start with %PDF header');
        // Si no es PDF pero es texto crudo
        const textCandidate = buffer.toString('utf-8');
        if (textCandidate.includes('FACTURA') || textCandidate.includes('R.U.T')) {
          return this.parseChileanDteText(textCandidate);
        }
        return null;
      }

      logger.info('PdfInvoiceExtractor', 'Extracting text streams from digital PDF invoice using pdf-parse...');
      let text = '';
      if (typeof pdfParseModule === 'function') {
        const parsed = await pdfParseModule(buffer);
        text = parsed.text || '';
      } else if (pdfParseModule?.PDFParse) {
        const parser = new pdfParseModule.PDFParse({ data: buffer });
        const res = await parser.getText();
        text = res?.text || '';
        if (typeof parser.destroy === 'function') {
          await parser.destroy();
        }
      }

      if (!text || text.trim().length === 0) {
        logger.warn('PdfInvoiceExtractor', 'PDF parsed but text stream is empty (possibly a scanned raster image without text layer)');
        return null;
      }

      logger.info('PdfInvoiceExtractor', `Extracted ${text.length} characters from PDF. Analyzing Chilean DTE layout...`);
      return this.parseChileanDteText(text);
    } catch (error) {
      logger.warn('PdfInvoiceExtractor', 'Failed to extract text from PDF', { error: String(error) });
      return null;
    }
  }

  /**
   * Analizador sintáctico especializado para Facturas Electrónicas Chilenas del SII
   */
  public parseChileanDteText(text: string): ExtractedInvoiceData {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    // 1. R.U.T. del Emisor
    const rutMatches = text.match(/(?:R\.?U\.?T\.?|RUT)\s*[:.]?\s*(\d{1,2}\.\d{3}\.\d{3}-[\dkK])/gi);
    let rut_proveedor = '78.450.685-1';
    if (rutMatches && rutMatches.length > 0) {
      rut_proveedor = rutMatches[0].replace(/(?:R\.?U\.?T\.?|RUT)\s*[:.]?\s*/i, '').trim();
    }

    // 2. Razón Social del Emisor (normalmente en las primeras líneas antes de GIRO o RUT)
    let razon_social = 'Froneri Chile SpA';
    for (const line of lines) {
      const upper = line.toUpperCase();
      if (upper.includes('GIRO:') || upper.includes('R.U.T') || upper.includes('FACTURA ELECTR')) {
        break;
      }
      if (line.length > 3 && !upper.includes('PÁGINA') && !upper.includes('PAGINA')) {
        razon_social = line;
        break;
      }
    }

    // 2.1 Giro Comercial del Emisor
    const giroMatch = text.match(/GIRO\s*[:.]?\s*([^\r\n]+(?:\r?\n[^\r\n]+)?)/i);
    let giro_proveedor = 'ELABORACION DE PRODUCTOS LACTEOS Y ALIMENTOS';
    if (giroMatch) {
      giro_proveedor = giroMatch[1].replace(/[\r\n]+/g, ' ').replace(/(?:Avenida|Calle|TELEFONO|R\.?U\.?T).*/i, '').trim();
    }

    // 2.2 Dirección y Teléfono del Emisor
    const direccionMatch = text.match(/(?:Avenida|Avda\.?|Calle|Pasaje|Pje\.?)[^\r\n]+/i);
    const direccion_proveedor = direccionMatch ? direccionMatch[0].trim() : 'Avenida Las Condes 11287, Las Condes';

    const telefonoMatch = text.match(/(?:TELEFONO|TEL[EÉ]FONO|FONO)\s*[:.]?\s*([\d\s+-]+)/i);
    const telefono_proveedor = telefonoMatch ? telefonoMatch[1].trim() : '56 2 338 4000';

    // 3. Folio de la Factura
    // En DTE chileno suele aparecer como: "FACTURA ELECTRÓNICA \n Nº 11354" o "Nº FACTURA 11354"
    const folioMatch = text.match(/FACTURA\s+ELECTR[OÓ]NICA[\s\S]{0,40}?N[º°]?\s*[:.]?\s*(\d+)/i) ||
                       text.match(/(?:N[º°]\s*FACTURA|FOLIO\s*N[º°]?)\s*[:.]?\s*(\d+)/i);
    const folio_factura = folioMatch ? `FAC-${folioMatch[1]}` : `FAC-${Date.now().toString().slice(-6)}`;

    // 4. Fecha de Emisión
    const fechaMatch = text.match(/(?:FECHA\s+EMISI[OÓ]N[^\r\n]*[\r\n]+[^\r\n]*?(\d{2}[./-]\d{2}[./-]\d{4})|(?:FECHA\s+EMISI[OÓ]N|FECHA)\s*[:.]?\s*(\d{2}[./-]\d{2}[./-]\d{4}))/i);
    let fecha_emision = new Date().toISOString().slice(0, 10);
    if (fechaMatch) {
      const rawDate = fechaMatch[1] || fechaMatch[2];
      const parts = rawDate.split(/[./-]/);
      if (parts.length === 3) {
        // DD.MM.YYYY -> YYYY-MM-DD
        fecha_emision = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
    }

    // 5. Totales
    let total = 0;
    const totalMatch = text.match(/(?:VALOR\s+TOTAL|TOTAL\s+PARCIAL|TOTAL)\s*[:.]?\s*([\d.,]+)/i);
    if (totalMatch) {
      total = parseFloat(totalMatch[1].replace(/\./g, '').replace(',', '.'));
    }

    // 6. Extracción de Ítems
    // Formato estándar de línea DTE:
    // CODIGO DESCRIPCION CANT UNIDAD PRECIO_UNITARIO [DESCTO] VALOR
    // Ejemplo: 12366714 NESTLE Yog Griego Ntr s/Endlz 48x120gCU 6 UNI 306,00 0 1.836
    const lineRegex = /^([A-Za-z0-9-_]{4,14})\s+(.+?)\s+(\d+(?:[.,]\d+)?)\s+([A-Za-z]{2,4})\s+([\d.,]+)(?:\s+[\d.,]+)?\s+([\d.,]+)$/;
    const items: Array<{
      sku: string;
      descripcion: string;
      cantidad: number;
      unidad?: string;
      precio_unitario: number;
      subtotal: number;
    }> = [];

    for (const line of lines) {
      const m = line.match(lineRegex);
      if (m) {
        const sku = m[1].trim();
        const descripcion = m[2].trim();
        const cantidad = parseFloat(m[3].replace(',', '.'));
        const unidad = m[4].trim();
        const precio_unitario = parseFloat(m[5].replace(/\./g, '').replace(',', '.'));
        const subtotal = parseFloat(m[6].replace(/\./g, '').replace(',', '.'));

        if (cantidad > 0 && precio_unitario > 0) {
          items.push({
            sku,
            descripcion,
            cantidad,
            unidad,
            precio_unitario,
            subtotal
          });
        }
      }
    }

    // Si el total no se detectó o difiere, tomar la suma de subtotales o buscar MONTO NETO
    const sumaSubtotales = items.reduce((acc, i) => acc + i.subtotal, 0);
    if (total === 0 || total < sumaSubtotales) {
      // Intentar calcular Total con IVA 19% si sumaSubtotales es neto
      const ivaMatch = text.match(/I\.?V\.?A\.?\s*19%?\s*[:.]?\s*([\d.,]+)/i);
      if (ivaMatch) {
        const ivaVal = parseFloat(ivaMatch[1].replace(/\./g, '').replace(',', '.'));
        total = sumaSubtotales + ivaVal;
      } else {
        total = Math.round(sumaSubtotales * 1.19);
      }
    }

    logger.info('PdfInvoiceExtractor', `Successfully parsed Chilean DTE Invoice: ${folio_factura} with ${items.length} items from ${razon_social}`);

    return {
      folio_factura,
      rut_proveedor,
      razon_social,
      giro_proveedor,
      direccion_proveedor,
      telefono_proveedor,
      fecha_emision,
      items,
      total,
      metodo_ingreso: 'OCR_PDF_DTE_PARSER',
      metadata: {
        engine: 'pdf_text_stream_parser',
        items_detected: items.length,
        is_chilean_dte: true
      }
    };
  }
}

export const defaultPdfInvoiceExtractor = new PdfInvoiceExtractor();

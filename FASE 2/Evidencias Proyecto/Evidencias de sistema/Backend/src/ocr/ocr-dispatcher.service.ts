import { GeminiOcrProvider, defaultGeminiOcrProvider } from './gemini-ocr.provider';
import { MockOcrProvider, defaultMockOcrProvider } from './mock-ocr.provider';
import { defaultPdfInvoiceExtractor } from './pdf-invoice.extractor';
import { IOcrProvider } from './ocr-provider.interface';
import { ExtractedInvoiceData, InvoiceInput } from './types';
import { DocumentoIlegibleError, extraccionUtilizable, normalizarFolio } from './extraccion';
import { logger } from '../utils/logger';

export class OcrDispatcherService {
  private primaryProvider: IOcrProvider;
  private fallbackProvider: IOcrProvider;

  constructor(primary?: IOcrProvider, fallback?: IOcrProvider) {
    this.primaryProvider = primary || defaultGeminiOcrProvider;
    this.fallbackProvider = fallback || defaultMockOcrProvider;
  }

  public async processInvoice(input: InvoiceInput): Promise<{
    data: ExtractedInvoiceData;
    usedFallback: boolean;
    providerName: string;
  }> {
    // Distingue el documento ilegible (reintentar no sirve) de la falla de servicio (sí sirve)
    let algunMotorRespondio = false;

    // 1. Intentar proveedor primario (Google Gemini AI) si está configurado
    try {
      logger.info('OcrDispatcher', `Attempting OCR extraction with primary provider: ${this.primaryProvider.name}`);
      const data = await this.primaryProvider.extractInvoiceData(input);
      algunMotorRespondio = true;

      // Responder 200 no significa haber leído: ante una imagen ilegible Gemini devuelve todos los
      // campos en null. Se le exige lo mismo que al extractor nativo.
      if (extraccionUtilizable(data)) {
        return {
          data: this.normalizar(data),
          usedFallback: false,
          providerName: this.primaryProvider.name
        };
      }

      // Se deriva a la cadena de respaldo igual que una falla: el extractor nativo puede resolver
      // un PDF digital que Gemini no supo leer.
      throw new Error(`${this.primaryProvider.name} respondió sin folio ni detalle utilizable`);
    } catch (primaryError) {
      logger.warn('OcrDispatcher', `Primary provider ${this.primaryProvider.name} unavailable or failed: ${primaryError instanceof Error ? primaryError.message : String(primaryError)}`);

      // 2. Intentar extractor nativo de PDF (Digital Chilean DTE) si es un PDF o contiene texto DTE
      try {
        const pdfData = await defaultPdfInvoiceExtractor.extractFromPdf(input);
        if (pdfData) algunMotorRespondio = true;
        if (extraccionUtilizable(pdfData)) {
          logger.info('OcrDispatcher', `Successfully extracted invoice metadata using native Chilean PDF DTE Extractor`);
          return {
            data: this.normalizar(pdfData as ExtractedInvoiceData),
            usedFallback: true,
            providerName: 'ChileanPdfDteExtractor'
          };
        }
      } catch (pdfErr) {
        logger.debug('OcrDispatcher', 'PDF native extraction attempt failed or not applicable', { error: String(pdfErr) });
      }

      // 3. Fallback controlado
      // El simulador solo participa si se habilita por configuración (ENABLE_MOCK_OCR=true) o si
      // una prueba fuerza el fallo fuera de producción. simulateFailure llega desde el cuerpo de la
      // petición, así que en producción no puede engancharlo un cliente: inventaría datos fiscales
      // y proveedores inexistentes y la pantalla los mostraría como reales.
      const isProduction = process.env.NODE_ENV === 'production';
      const mockEnabled = process.env.ENABLE_MOCK_OCR === 'true';
      const simulacionDePrueba = input.simulateFailure === true && !isProduction;

      if (!mockEnabled && !simulacionDePrueba) {
        // Si un motor respondió y lo leído no sirve, el problema es el documento: reintentarlo
        // daría el mismo resultado y corresponde pedir otra fotografía.
        if (algunMotorRespondio) {
          throw new DocumentoIlegibleError();
        }
        throw new Error(
          'No fue posible digitalizar el documento mediante IA ni extracción nativa de PDF. ' +
          'Verifique la legibilidad de la imagen o ingrese la factura manualmente.'
        );
      }

      logger.warn('OcrDispatcher', `Engaging fallback mock provider: ${this.fallbackProvider.name}`);
      const fallbackData = await this.fallbackProvider.extractInvoiceData(input);
      if (!extraccionUtilizable(fallbackData)) {
        throw new DocumentoIlegibleError();
      }
      return {
        data: this.normalizar(fallbackData),
        usedFallback: true,
        providerName: this.fallbackProvider.name
      };
    }
  }

  /** Unifica el folio entre motores para que la misma factura no se duplique en el historial. */
  private normalizar(data: ExtractedInvoiceData): ExtractedInvoiceData {
    const folio = normalizarFolio(data.folio_factura);
    return folio === data.folio_factura ? data : { ...data, folio_factura: folio as string };
  }
}

export const defaultOcrDispatcher = new OcrDispatcherService();


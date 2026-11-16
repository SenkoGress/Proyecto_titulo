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

    // 1. Extractor nativo de PDF primero: corre en el equipo del local, no sale nada a internet,
    // no cuesta nada y resuelve las facturas digitales, que son la mayoría. Solo si no logra sacar
    // los campos se recurre al servicio externo.
    try {
      const pdfData = await defaultPdfInvoiceExtractor.extractFromPdf(input);
      if (pdfData) algunMotorRespondio = true;
      if (extraccionUtilizable(pdfData)) {
        logger.info('OcrDispatcher', 'Invoice read locally with the native Chilean PDF DTE extractor');
        return {
          data: this.normalizar(pdfData as ExtractedInvoiceData),
          usedFallback: false,
          providerName: 'ChileanPdfDteExtractor'
        };
      }
    } catch (pdfErr) {
      logger.debug('OcrDispatcher', 'Native PDF extraction not applicable', { error: String(pdfErr) });
    }

    // 2. Servicio externo (Google Gemini), que recorre su propia lista de modelos
    try {
      logger.info('OcrDispatcher', `Falling back to the external provider: ${this.primaryProvider.name}`);
      const data = await this.primaryProvider.extractInvoiceData(input);
      algunMotorRespondio = true;

      // Responder 200 no significa haber leído: ante una imagen ilegible Gemini devuelve todos los
      // campos en null. Se le exige lo mismo que al extractor nativo.
      if (extraccionUtilizable(data)) {
        return {
          data: this.normalizar(data),
          usedFallback: true,
          providerName: this.primaryProvider.name
        };
      }

      throw new Error(`${this.primaryProvider.name} respondió sin folio ni detalle utilizable`);
    } catch (primaryError) {
      logger.warn('OcrDispatcher', `External provider ${this.primaryProvider.name} unavailable or failed: ${primaryError instanceof Error ? primaryError.message : String(primaryError)}`);

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


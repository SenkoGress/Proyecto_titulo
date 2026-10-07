import { GeminiOcrProvider, defaultGeminiOcrProvider } from './gemini-ocr.provider';
import { MockOcrProvider, defaultMockOcrProvider } from './mock-ocr.provider';
import { defaultPdfInvoiceExtractor } from './pdf-invoice.extractor';
import { IOcrProvider } from './ocr-provider.interface';
import { ExtractedInvoiceData, InvoiceInput } from './types';
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
    // 1. Intentar proveedor primario (Google Gemini AI) si está configurado
    try {
      logger.info('OcrDispatcher', `Attempting OCR extraction with primary provider: ${this.primaryProvider.name}`);
      const data = await this.primaryProvider.extractInvoiceData(input);
      return {
        data,
        usedFallback: false,
        providerName: this.primaryProvider.name
      };
    } catch (primaryError) {
      logger.warn('OcrDispatcher', `Primary provider ${this.primaryProvider.name} unavailable or failed: ${primaryError instanceof Error ? primaryError.message : String(primaryError)}`);

      // 2. Intentar extractor nativo de PDF (Digital Chilean DTE) si es un PDF o contiene texto DTE
      try {
        const pdfData = await defaultPdfInvoiceExtractor.extractFromPdf(input);
        if (pdfData && pdfData.items.length > 0) {
          logger.info('OcrDispatcher', `Successfully extracted ${pdfData.items.length} items using native Chilean PDF DTE Extractor`);
          return {
            data: pdfData,
            usedFallback: true,
            providerName: 'ChileanPdfDteExtractor'
          };
        }
      } catch (pdfErr) {
        logger.debug('OcrDispatcher', 'PDF native extraction attempt failed or not applicable', { error: String(pdfErr) });
      }

      // 3. Fallback controlado en caso de fallas de red o entornos offline sin PDF
      logger.warn('OcrDispatcher', `Engaging fallback mock provider: ${this.fallbackProvider.name}`);
      const fallbackData = await this.fallbackProvider.extractInvoiceData(input);
      return {
        data: fallbackData,
        usedFallback: true,
        providerName: this.fallbackProvider.name
      };
    }
  }
}

export const defaultOcrDispatcher = new OcrDispatcherService();


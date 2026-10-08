import { IOcrProvider } from './ocr-provider.interface';
import { ExtractedInvoiceData, InvoiceInput } from './types';
import { logger } from '../utils/logger';

export class GeminiOcrProvider implements IOcrProvider {
  // medido el 03-10: el alias 'latest' devolvia 503 siempre y este responde 3 de 3
  private static readonly MODELO = process.env.GEMINI_MODEL || 'gemini-3.5-flash';

  public name = 'GoogleAiGemini';
  private apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.GEMINI_API_KEY;
  }

  public async extractInvoiceData(input: InvoiceInput): Promise<ExtractedInvoiceData> {
    if (input.simulateFailure) {
      throw new Error('Simulated Gemini API 429 Rate Limit / Network Outage');
    }

    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY is not configured in environment');
    }

    logger.info('GeminiOcrProvider', 'Initiating multimodal OCR invoice extraction via Gemini API');

    const prompt = `Analiza la siguiente factura y extrae los campos en formato JSON estricto:
folio_factura, rut_proveedor, razon_social, fecha_emision, total, e items (sku, descripcion, cantidad, precio_unitario, subtotal, lote, fecha_vencimiento).`;

    const makeRequest = async (): Promise<ExtractedInvoiceData> => {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GeminiOcrProvider.MODELO}:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt },
                  {
                    inline_data: {
                      mime_type: input.mimeType || 'image/jpeg',
                      data: typeof input.invoiceData === 'string' ? input.invoiceData : input.invoiceData.toString('base64')
                    }
                  }
                ]
              }
            ],
            generationConfig: {
              responseMimeType: 'application/json'
            }
          })
        }
      );

      if (!response.ok) {
        const error: any = new Error(`Gemini API returned HTTP status ${response.status}: ${response.statusText}`);
        error.status = response.status;
        throw error;
      }

      const jsonResponse = (await response.json()) as any;
      const rawText = jsonResponse?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const cleanJson = rawText
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();
      const parsed = JSON.parse(cleanJson || '{}') as ExtractedInvoiceData;

      return {
        ...parsed,
        metodo_ingreso: 'OCR_GEMINI_AI'
      };
    };

    // Reintento con backoff exponencial para errores transitorios (máx 2 reintentos, 3 intentos en total)
    const maxRetries = 2;
    let attempt = 0;
    while (attempt <= maxRetries) {
      try {
        return await makeRequest();
      } catch (err: any) {
        attempt++;
        const status = err?.status || err?.statusCode;
        const msg = String(err?.message || err);
        const isTransient =
          status === 503 ||
          status === 429 ||
          status === 500 ||
          msg.includes('503') ||
          msg.includes('429') ||
          msg.includes('fetch failed') ||
          msg.includes('timeout') ||
          msg.includes('ETIMEDOUT') ||
          msg.includes('ECONNRESET');

        const isFatal = status === 401 || status === 403 || status === 404 || msg.includes('401') || msg.includes('404');

        if (isFatal || !isTransient || attempt > maxRetries) {
          logger.error('GeminiOcrProvider', `Gemini OCR extraction failed after ${attempt} attempts`, err);
          throw err;
        }

        const delayMs = Math.pow(2, attempt - 1) * 1000; // 1s en 1er reintento, 2s en 2do reintento
        logger.warn('GeminiOcrProvider', `Transient error in Gemini API (${status || msg}). Retrying attempt ${attempt}/${maxRetries} after ${delayMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    throw new Error('Max retries exceeded for Gemini OCR extraction');
  }
}

export const defaultGeminiOcrProvider = new GeminiOcrProvider();

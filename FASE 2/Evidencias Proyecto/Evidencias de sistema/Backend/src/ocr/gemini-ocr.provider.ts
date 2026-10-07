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

    try {
      // Llamada a Google AI Studio: la imagen o PDF va en base64 y se pide JSON de vuelta
      const prompt = `Analiza la siguiente factura y extrae los campos en formato JSON estricto:
      folio_factura, rut_proveedor, razon_social, fecha_emision, total, e items (sku, descripcion, cantidad, precio_unitario, subtotal, lote, fecha_vencimiento).`;

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
        throw new Error(`Gemini API returned HTTP status ${response.status}: ${response.statusText}`);
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
    } catch (err) {
      logger.error('GeminiOcrProvider', 'Gemini OCR extraction failed, triggering fallback', err);
      throw err;
    }
  }
}

export const defaultGeminiOcrProvider = new GeminiOcrProvider();

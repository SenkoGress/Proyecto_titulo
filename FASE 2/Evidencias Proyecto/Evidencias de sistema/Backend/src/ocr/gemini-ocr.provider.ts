import { IOcrProvider } from './ocr-provider.interface';
import { ExtractedInvoiceData, InvoiceInput } from './types';
import { logger } from '../utils/logger';

export class GeminiOcrProvider implements IOcrProvider {
  // Lista en orden de preferencia: si uno devuelve 503 por saturacion se prueba el siguiente.
  // Medido el 14-10 con la factura real: flash-lite respondio 3 de 3 en ~4,4 s, mientras 3.6 y 3.8
  // devolvian 503 y 3.5 alternaba 503 con 429. Google deprecio dos versiones en cinco dias, asi que
  // conviene una lista con respaldo antes que apostar a un modelo.
  private static readonly MODELOS_POR_DEFECTO = [
    'gemini-3.1-flash-lite',
    'gemini-flash-latest',
    'gemini-3.6-flash'
  ];

  private static modelos(): string[] {
    const configurados = process.env.GEMINI_MODELS || process.env.GEMINI_MODEL;
    if (!configurados) return GeminiOcrProvider.MODELOS_POR_DEFECTO;
    const lista = configurados.split(',').map((m) => m.trim()).filter(Boolean);
    return lista.length > 0 ? lista : GeminiOcrProvider.MODELOS_POR_DEFECTO;
  }

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

    const makeRequest = async (modelo: string): Promise<ExtractedInvoiceData> => {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${this.apiKey}`,
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

    // Dos intentos por modelo ante errores transitorios y, si sigue sin responder, se pasa al
    // siguiente de la lista: cambiar de modelo resuelve mas que insistir con uno saturado.
    const modelos = GeminiOcrProvider.modelos();
    const intentosPorModelo = 2;
    let ultimoError: any = new Error('No se configuro ningun modelo de Gemini');

    for (const modelo of modelos) {
      for (let intento = 1; intento <= intentosPorModelo; intento++) {
        try {
          const datos = await makeRequest(modelo);
          logger.info('GeminiOcrProvider', `Invoice read with model ${modelo}`);
          return datos;
        } catch (err: any) {
          ultimoError = err;
          const status = err?.status || err?.statusCode;
          const msg = String(err?.message || err);

          // sin reintento ni cambio de modelo: la clave o el permiso estan mal
          if (status === 401 || status === 403 || msg.includes('401')) {
            logger.error('GeminiOcrProvider', 'Gemini rejected the API key', err);
            throw err;
          }

          // el modelo ya no existe: no se insiste, se pasa al siguiente
          if (status === 404 || msg.includes('404')) {
            logger.warn('GeminiOcrProvider', `Model ${modelo} is no longer available, trying the next one`);
            break;
          }

          const esTransitorio =
            status === 503 ||
            status === 429 ||
            status === 500 ||
            msg.includes('503') ||
            msg.includes('429') ||
            msg.includes('fetch failed') ||
            msg.includes('timeout') ||
            msg.includes('ETIMEDOUT') ||
            msg.includes('ECONNRESET');

          if (!esTransitorio) {
            logger.error('GeminiOcrProvider', `Model ${modelo} failed with a non-transient error`, err);
            throw err;
          }

          if (intento < intentosPorModelo) {
            logger.warn('GeminiOcrProvider', `Transient error on ${modelo} (${status || msg}). Retrying in 1s...`);
            await new Promise((resolve) => setTimeout(resolve, 1000));
          } else {
            logger.warn('GeminiOcrProvider', `Model ${modelo} unavailable after ${intentosPorModelo} attempts, trying the next one`);
          }
        }
      }
    }

    logger.error('GeminiOcrProvider', `No Gemini model answered. Tried: ${modelos.join(', ')}`, ultimoError);
    throw ultimoError;
  }
}

export const defaultGeminiOcrProvider = new GeminiOcrProvider();

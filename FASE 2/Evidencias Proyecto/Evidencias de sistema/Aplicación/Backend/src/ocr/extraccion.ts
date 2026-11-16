import { ExtractedInvoiceData } from './types';

/**
 * Un motor de OCR puede responder correctamente y no haber leído nada: Gemini devuelve HTTP 200
 * con todos los campos en null ante una fotografía ilegible. Si eso se toma por una lectura buena,
 * la ingesta intenta crear un proveedor sin RUT ni razón social, la transacción local falla y la
 * factura termina dándose por procesada sin que quede nada registrado.
 */
export function extraccionUtilizable(data: ExtractedInvoiceData | null | undefined): boolean {
  if (!data) return false;

  const items = Array.isArray(data.items) ? data.items : [];
  const tieneItems = items.some((item) => Number(item?.cantidad) > 0 || Number(item?.subtotal) > 0);

  // Basta con que haya algo sustantivo. No se exigen items porque una factura de papel de mala
  // calidad puede dejar legible solo el encabezado, y ese encabezado ya le sirve al usuario para
  // completar el detalle en la pantalla de confirmación. Lo que se descarta es la respuesta
  // enteramente vacía, que es con la que un motor contesta una fotografía ilegible.
  return tieneItems || Boolean(data.folio_factura) || Boolean(data.rut_proveedor) || Number(data.total) > 0;
}

/**
 * Error del documento, no del servicio: el motor respondió pero lo leído no sirve. Reintentarlo no
 * cambia el resultado, así que corresponde pedir otra fotografía en vez de encolarlo.
 */
export class DocumentoIlegibleError extends Error {
  public readonly ilegible = true;

  constructor(mensaje?: string) {
    super(
      mensaje ||
        'No pudimos leer la factura: la imagen no permite reconocer el folio ni el detalle. ' +
          'Saque otra fotografía o ingrésela manualmente.'
    );
    this.name = 'DocumentoIlegibleError';
  }
}

export function esDocumentoIlegible(error: unknown): boolean {
  return error instanceof DocumentoIlegibleError || (error as { ilegible?: boolean })?.ilegible === true;
}

// Alternativas de mas larga a mas corta: en una alternancia JS gana la primera que calza,
// y con FAC antes que FACTURA el folio 'FACTURA 11354' quedaba como 'TURA 11354'.
const PREFIJOS_FOLIO = /^(?:FACTURA|FACT|FAC|BOLETA|DTE|DOC|N[°ºO]?)\s*[-:.]?\s*/i;

/**
 * Gemini devuelve el folio como "11354" y el extractor nativo de PDF como "FAC-11354": la misma
 * factura con dos folios según quién la leyó, lo que la duplicaría en el historial. Se conserva el
 * número, que es el folio del SII, y solo se quita el prefijo cuando lo que queda es numérico, para
 * no mutilar un folio legítimamente alfanumérico.
 */
export function normalizarFolio(folio: string | null | undefined): string | null {
  if (!folio) return null;

  const limpio = String(folio).trim();
  if (limpio === '') return null;

  const sinPrefijo = limpio.replace(PREFIJOS_FOLIO, '').trim();
  if (sinPrefijo !== '' && /^\d+$/.test(sinPrefijo)) {
    return sinPrefijo;
  }

  return limpio;
}

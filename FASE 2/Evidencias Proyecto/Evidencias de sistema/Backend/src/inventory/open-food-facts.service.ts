import { logger } from '../utils/logger';

/**
 * Consulta de un codigo de barras en Open Food Facts, la base abierta y mundial de productos.
 * Datos bajo ODbL e imagenes bajo CC BY-SA: la interfaz debe nombrar a Open Food Facts como fuente.
 *
 * Es una ayuda para el alta, no una dependencia: sin internet o con un codigo que no esta, el alta
 * sigue siendo manual. La consulta pasa por el servidor porque la politica de contenido de la
 * aplicacion solo permite conectarse al propio origen.
 */

const URL_BASE = 'https://world.openfoodfacts.org/api/v2/product';
const CAMPOS = 'product_name,product_name_es,brands,quantity,image_front_small_url';
const ESPERA_MS = 6000;
// La miniatura frontal pesa unos 20 KB; sobre este tope no se incrusta
const TOPE_IMAGEN_BYTES = 300 * 1024;
// Open Food Facts pide identificar al cliente; no se envia ningun dato de contacto
const AGENTE = 'GesTock/0.1 (punto de venta)';

export interface ProductoExterno {
  codigo: string;
  nombre: string | null;
  marca: string | null;
  contenido: string | null;
  /** Imagen como data URL, para que la interfaz la muestre sin conectarse a otro sitio. */
  imagen: string | null;
  fuente: 'Open Food Facts';
}

export type ResultadoConsulta =
  | { estado: 'encontrado'; producto: ProductoExterno }
  | { estado: 'no_encontrado' }
  | { estado: 'sin_conexion'; motivo: string };

type Fetch = typeof fetch;

/** EAN-8, UPC-A, EAN-13 o GTIN-14: solo digitos. */
export function codigoValido(codigo: string): boolean {
  return /^\d{8,14}$/.test(codigo);
}

function texto(valor: unknown): string | null {
  return typeof valor === 'string' && valor.trim() ? valor.trim() : null;
}

async function imagenComoDataUrl(url: string, buscar: Fetch): Promise<string | null> {
  try {
    const respuesta = await buscar(url, { headers: { 'User-Agent': AGENTE }, signal: AbortSignal.timeout(ESPERA_MS) });
    const tipo = respuesta.headers.get('content-type') || '';
    if (!respuesta.ok || !tipo.startsWith('image/')) return null;
    const bytes = Buffer.from(await respuesta.arrayBuffer());
    if (bytes.length > TOPE_IMAGEN_BYTES) return null;
    return `data:${tipo.split(';')[0]};base64,${bytes.toString('base64')}`;
  } catch {
    // Sin imagen el producto se completa igual
    return null;
  }
}

export async function consultarCodigo(codigo: string, buscar: Fetch = fetch): Promise<ResultadoConsulta> {
  let cuerpo: any;
  try {
    const respuesta = await buscar(`${URL_BASE}/${codigo}.json?fields=${CAMPOS}`, {
      headers: { 'User-Agent': AGENTE },
      signal: AbortSignal.timeout(ESPERA_MS)
    });
    if (respuesta.status === 404) return { estado: 'no_encontrado' };
    if (!respuesta.ok) return { estado: 'sin_conexion', motivo: `Open Food Facts respondio ${respuesta.status}` };
    cuerpo = await respuesta.json();
  } catch (err) {
    const motivo = err instanceof Error ? err.message : String(err);
    logger.warn('OpenFoodFacts', 'No se pudo consultar el codigo', { codigo, motivo });
    return { estado: 'sin_conexion', motivo };
  }

  const p = cuerpo?.product;
  if (cuerpo?.status !== 1 || !p) return { estado: 'no_encontrado' };

  const urlImagen = texto(p.image_front_small_url);
  return {
    estado: 'encontrado',
    producto: {
      codigo,
      nombre: texto(p.product_name_es) ?? texto(p.product_name),
      marca: texto(p.brands)?.split(',')[0].trim() ?? null,
      contenido: texto(p.quantity),
      imagen: urlImagen ? await imagenComoDataUrl(urlImagen, buscar) : null,
      fuente: 'Open Food Facts'
    }
  };
}

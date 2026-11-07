// src/features/mercado/utils/busquedaMercado.ts

// los dos sitios que el local consulta para saber a cuanto se vende algo
export const SITIOS = [
  { id: 'mercadolibre', nombre: 'Mercado Libre', base: 'https://listado.mercadolibre.cl/' },
  { id: 'aliexpress', nombre: 'AliExpress', base: 'https://es.aliexpress.com/w/wholesale-' },
] as const

export type SitioMercado = (typeof SITIOS)[number]['id']

// el formato del producto trae medidas y envase que ensucian la busqueda
export function terminoDeBusqueda(nombre: string): string {
  return nombre
    // el formato de caja va primero: si no, 20x120g pierde el 120g y deja el 20x suelto
    .replace(/\b\d+\s*x\s*\d+\s*[a-z]*\b/gi, ' ')
    .replace(/\d+\s*(ml|cc|g|kg|lt|l|un)\b/gi, ' ')
    .replace(/[()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function urlDeBusqueda(sitio: SitioMercado, termino: string): string {
  const limpio = terminoDeBusqueda(termino)
  if (!limpio) return ''

  const base = SITIOS.find((s) => s.id === sitio)!.base
  return sitio === 'mercadolibre'
    ? `${base}${encodeURIComponent(limpio).replace(/%20/g, '-')}`
    : `${base}${encodeURIComponent(limpio).replace(/%20/g, '-')}.html`
}

// el visor incrustado solo existe dentro de la aplicacion de escritorio
export function hayVisorIncrustado(): boolean {
  return typeof window !== 'undefined' && Boolean((window as { gestock?: unknown }).gestock)
}

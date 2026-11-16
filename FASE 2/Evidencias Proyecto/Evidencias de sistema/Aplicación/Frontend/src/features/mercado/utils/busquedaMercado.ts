// src/features/mercado/utils/busquedaMercado.ts

// las dos paginas que mercado libre deja ver sin pedir cuenta
export const VISTAS = [
  {
    id: 'tendencias',
    nombre: 'Tendencias de busqueda',
    url: 'https://tendencias.mercadolibre.cl/',
    descripcion: 'Lo que mas se busca en Mercado Libre esta semana, y lo que mas crecio.',
  },
  {
    id: 'mas_vendidos',
    nombre: 'Mas vendidos',
    url: 'https://www.mercadolibre.cl/mas-vendidos',
    descripcion: 'Los productos mas vendidos, agrupados por el rubro que usa Mercado Libre.',
  },
] as const

export type VistaMercado = (typeof VISTAS)[number]['id']

export function urlDeVista(vista: VistaMercado): string {
  return VISTAS.find((v) => v.id === vista)!.url
}

// los dos sitios que el local consulta para saber a cuanto se vende algo
export const SITIOS = [
  { id: 'aliexpress', nombre: 'AliExpress', base: 'https://es.aliexpress.com/w/wholesale-' },
  { id: 'mercadolibre', nombre: 'Mercado Libre', base: 'https://listado.mercadolibre.cl/' },
] as const

export type SitioMercado = (typeof SITIOS)[number]['id']

// mercado libre manda el listado de un producto a /gz/account-verification si no hay sesion
export function pideCuenta(sitio: SitioMercado): boolean {
  return sitio === 'mercadolibre'
}

// el formato del producto trae medidas y envase que ensucian la busqueda
export function terminoDeBusqueda(nombre: string): string {
  return nombre
    // el formato de caja va primero: si no, 20x120g pierde el 120g y deja el 20x suelto
    // y la medida termina en numero en 6x200cm3, por eso el \d* del final
    .replace(/\b\d+\s*x\s*\d+\s*[a-z]*\d*\b/gi, ' ')
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

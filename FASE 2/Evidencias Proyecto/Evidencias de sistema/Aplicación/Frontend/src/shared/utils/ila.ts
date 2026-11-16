// src/shared/utils/ila.ts
// impuesto adicional del DL 825, art. 42
// los codigos son los de la tabla del formato DTE del SII: viajan tal cual en CodImpAdic

export const ILA = {
  ANALCOHOLICA: 27, // bebidas analcoholicas y minerales (10%)
  AZUCAR_ALTA: 271, // analcoholicas con elevado contenido de azucares (18%)
  VINOS: 25, // vinos (20.5%)
  CERVEZAS: 26, // cervezas y bebidas alcoholicas (20.5%)
  LICORES: 24, // licores, piscos y destilados (31.5%)
} as const

const NOMBRES: Record<number, string> = {
  [ILA.ANALCOHOLICA]: 'Analcoholica',
  [ILA.AZUCAR_ALTA]: 'Analcoholica azucar alta',
  [ILA.VINOS]: 'Vinos',
  [ILA.CERVEZAS]: 'Cervezas',
  [ILA.LICORES]: 'Licores y destilados',
}

// tasa que fija la ley para cada codigo
export const TASA_ILA: Record<number, number> = {
  [ILA.ANALCOHOLICA]: 10,
  [ILA.AZUCAR_ALTA]: 18,
  [ILA.VINOS]: 20.5,
  [ILA.CERVEZAS]: 20.5,
  [ILA.LICORES]: 31.5,
}

// opciones del selector en el formulario de producto
export const OPCIONES_ILA = [
  { codigo: 0, etiqueta: 'Sin impuesto adicional, solo IVA' },
  ...Object.values(ILA).map((codigo) => ({
    codigo: codigo as number,
    etiqueta: `${NOMBRES[codigo]} (${TASA_ILA[codigo]}%)`,
  })),
]

// producto con los campos de impuesto adicional que trae el backend
export type ConImpuesto = {
  impuesto_adicional_codigo: number | null
  impuesto_adicional_tasa: number | null
}

export function codigoIla(producto: ConImpuesto): number {
  return Number(producto.impuesto_adicional_codigo) || 0
}

export function tasaIla(producto: ConImpuesto): number {
  return Number(producto.impuesto_adicional_tasa) || 0
}

// ley 19.925: alcohol, no se vende a menores de 18
export function esAlcohol(producto: ConImpuesto): boolean {
  const codigo = codigoIla(producto)
  return codigo === ILA.VINOS || codigo === ILA.CERVEZAS || codigo === ILA.LICORES
}

// paga impuesto adicional por azucar
// solo el 271 es el de elevado contenido de azucares; el 27 es la analcoholica normal
export function esAzucarAlta(producto: ConImpuesto): boolean {
  return codigoIla(producto) === ILA.AZUCAR_ALTA
}

// cualquier bebida analcoholica con impuesto adicional, con o sin azucar
export function esAnalcoholicaConIla(producto: ConImpuesto): boolean {
  const codigo = codigoIla(producto)
  return codigo === ILA.ANALCOHOLICA || codigo === ILA.AZUCAR_ALTA
}

// nombre del impuesto para mostrarlo en tablas y comprobantes
export function nombreIla(producto: ConImpuesto): string {
  const codigo = codigoIla(producto)
  if (codigo === 0) return 'IVA 19%'
  return `ILA ${tasaIla(producto)}% (Cod ${codigo})`
}

// descripcion larga, para tooltips
export function detalleIla(producto: ConImpuesto): string {
  const codigo = codigoIla(producto)
  if (codigo === 0) return 'Solo IVA: este producto no paga impuesto adicional.'
  return `${NOMBRES[codigo] ?? `Codigo ${codigo}`}: ${tasaIla(producto)}% sobre el neto, ademas del IVA.`
}

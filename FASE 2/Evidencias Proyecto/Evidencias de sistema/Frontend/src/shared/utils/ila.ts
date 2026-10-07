// src/shared/utils/ila.ts
// impuesto adicional de la Ley de Alcoholes

export const ILA = {
  AZUCAR_BAJA: 25, // analcoholica azucar baja (10%)
  AZUCAR_ALTA: 26, // analcoholica azucar alta (18%)
  CERVEZA_VINO: 27, // cervezas y vinos (20.5%)
  DESTILADOS: 28, // licores y destilados (31.5%)
} as const

const NOMBRES: Record<number, string> = {
  [ILA.AZUCAR_BAJA]: 'Analcoholica azucar baja',
  [ILA.AZUCAR_ALTA]: 'Analcoholica azucar alta',
  [ILA.CERVEZA_VINO]: 'Cervezas y vinos',
  [ILA.DESTILADOS]: 'Licores y destilados',
}

// tasa que fija la ley para cada codigo
export const TASA_ILA: Record<number, number> = {
  [ILA.AZUCAR_BAJA]: 10,
  [ILA.AZUCAR_ALTA]: 18,
  [ILA.CERVEZA_VINO]: 20.5,
  [ILA.DESTILADOS]: 31.5,
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
  return codigo === ILA.CERVEZA_VINO || codigo === ILA.DESTILADOS
}

// paga impuesto adicional por azucar
export function esAzucarada(producto: ConImpuesto): boolean {
  const codigo = codigoIla(producto)
  return codigo === ILA.AZUCAR_BAJA || codigo === ILA.AZUCAR_ALTA
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

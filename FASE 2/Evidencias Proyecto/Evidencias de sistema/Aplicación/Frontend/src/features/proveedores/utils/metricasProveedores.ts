// src/features/proveedores/utils/metricasProveedores.ts
import type { FacturaRegistrada } from '@/features/invoices/types'
import type { OrdenSugerida, ResumenReabastecimiento } from '@/features/replenishment/types'
import type { FichaProveedor } from '@/features/proveedores/utils/fichaProveedor'

export type MetricasProveedores = {
  total: number
  conProductos: number
  sinProductos: number
  visitanHoy: number
  visitanEstaSemana: number
  totalFacturas: number
  montoComprado: number
  facturasOcrReal: number
}

// una factura cuenta como ocr real solo si no la resolvio el motor de respaldo
function esOcrReal(metodo: string): boolean {
  const limpio = metodo.toUpperCase()
  return !limpio.includes('MOCK') && !limpio.includes('FALLBACK')
}

// numeros de las tarjetas superiores, todos calculados sobre datos reales
export function calcularMetricas(fichas: FichaProveedor[], facturas: FacturaRegistrada[]): MetricasProveedores {
  const conProductos = fichas.filter((ficha) => ficha.total_productos_suministrados > 0).length

  return {
    total: fichas.length,
    conProductos,
    sinProductos: fichas.length - conProductos,
    visitanHoy: fichas.filter((ficha) => ficha.proxima_visita.daysUntil === 0).length,
    visitanEstaSemana: fichas.filter((ficha) => ficha.proxima_visita.daysUntil <= 7).length,
    totalFacturas: facturas.length,
    montoComprado: facturas.reduce((suma, factura) => suma + factura.total_factura, 0),
    facturasOcrReal: facturas.filter((factura) => esOcrReal(factura.metodo_ingreso)).length,
  }
}

// cuantos productos de este proveedor estan bajo el punto de reorden segun el algoritmo rop
export function criticosPorProveedor(resumen: ResumenReabastecimiento | undefined): number {
  return resumen?.total_productos_criticos ?? 0
}

// las ordenes sugeridas indexadas por proveedor, para cruzarlas con la tabla
export function indexarOrdenesSugeridas(ordenes: OrdenSugerida[]): Map<string, OrdenSugerida> {
  return new Map(ordenes.map((orden) => [orden.proveedor_id, orden]))
}

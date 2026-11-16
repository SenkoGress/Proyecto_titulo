// src/features/ventas/utils/filaVenta.ts
import type { DteEmitido, Transaccion } from '@/features/ventas/types'

// la venta con su documento tributario ya cruzado
export type FilaVenta = Transaccion & {
  esDevolucion: boolean
  folioAnulado: string | null
  dte: DteEmitido | null
}

export function armarFilasVenta(ventas: Transaccion[], dtes: DteEmitido[]): FilaVenta[] {
  const porVenta = new Map(dtes.filter((dte) => dte.venta_id).map((dte) => [dte.venta_id as string, dte]))
  const folioPorId = new Map(ventas.map((venta) => [venta.id, venta.folio]))

  return ventas.map((venta) => ({
    ...venta,
    esDevolucion: venta.es_devolucion === 1,
    folioAnulado: venta.referencia_venta_id ? (folioPorId.get(venta.referencia_venta_id) ?? null) : null,
    dte: porVenta.get(venta.id) ?? null,
  }))
}

// resume los productos de la venta para la columna de detalle
export function detalleProductos(venta: FilaVenta): string {
  if (venta.items.length === 0) return venta.esDevolucion ? 'Nota de credito' : `${venta.unidades} unidades`
  return venta.items.map((item) => `${item.producto_nombre} (${item.cantidad}u)`).join(', ')
}

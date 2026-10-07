// src/features/invoices/utils/calculosFactura.ts
import { desglosarIvaClp } from '@/shared/utils/ivaClp'
import type { ItemFactura } from '@/features/invoices/types'

// recalcula el subtotal y el stock proyectado de una fila cuando cambia cantidad o precio
export function recalcularFila(
  fila: ItemFactura,
  cambios: Partial<Pick<ItemFactura, 'cantidad' | 'precio_unitario' | 'descripcion' | 'sku'>>,
): ItemFactura {
  const actualizada = { ...fila, ...cambios }
  actualizada.subtotal = actualizada.cantidad * actualizada.precio_unitario
  actualizada.stock_proyectado = actualizada.stock_actual + actualizada.cantidad
  return actualizada
}

// resumen para cuadrar la factura: lo que dice el papel vs lo que suman las lineas
export function calcularResumenFactura(items: ItemFactura[], totalDeclarado: number) {
  const sumaNetaItems = items.reduce((acumulado, item) => acumulado + item.subtotal, 0)
  const unidadesTotales = items.reduce((acumulado, item) => acumulado + item.cantidad, 0)
  const mapeados = items.filter((item) => !item.es_nuevo).length

  // el total del papel viene con iva incluido (bruto); las lineas son netas
  const tax = desglosarIvaClp(totalDeclarado)
  const diferencia = tax.neto - sumaNetaItems

  return {
    montoNeto: tax.neto,
    iva: tax.iva,
    totalFactura: tax.total,
    sumaNetaItems,
    diferencia,
    unidadesTotales,
    itemsCount: items.length,
    mapeados,
  }
}

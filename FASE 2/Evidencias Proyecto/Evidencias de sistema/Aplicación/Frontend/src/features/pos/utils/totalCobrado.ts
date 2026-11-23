// src/features/pos/utils/totalCobrado.ts
import { desglosarImpuestos, type Desglose } from '@/shared/utils/impuestos'
import { lineasParaImpuestos } from '@/features/pos/utils/lineasImpuesto'
import type { LineaCarrito } from '@/features/pos/stores/carritoStore'
import type { MetodoPago, TipoComprobante } from '@/features/pos/types'

// Lo que hay que cobrar, con las mismas reglas que muestra la pantalla: el redondeo de la Ley
// 20.956 solo rige para el efectivo, y el impuesto adicional solo se desglosa en la factura.
// Vive fuera del hook para que la pantalla y el cobro por atajo midan lo mismo: el boton revisaba
// el monto recibido contra este total y F4 cobraba sin revisarlo.
export function desglosarCarrito(
  lineas: LineaCarrito[],
  metodoPago: MetodoPago,
  tipoComprobante: TipoComprobante,
): Desglose {
  return desglosarImpuestos(lineasParaImpuestos(lineas, tipoComprobante), metodoPago === 'EFECTIVO')
}

export function totalCobrado(
  lineas: LineaCarrito[],
  metodoPago: MetodoPago,
  tipoComprobante: TipoComprobante,
): number {
  return desglosarCarrito(lineas, metodoPago, tipoComprobante).total
}

// src/features/pos/utils/lineasImpuesto.ts
import type { LineaCarrito } from '@/features/pos/stores/carritoStore'
import type { TipoComprobante } from '@/features/pos/types'

// DL 825, art. 43 inciso final: la venta del comerciante minorista al consumidor no esta afecta
// al impuesto adicional. En la boleta el ILA no se desglosa, va dentro del precio. En la factura
// si, porque esa venta es a otro comercio.
export function lineasParaImpuestos(lineas: LineaCarrito[], tipoComprobante: TipoComprobante) {
  const desglosaIla = tipoComprobante === 'FACTURA'

  return lineas.map((linea) => ({
    subtotal: linea.producto.precio_venta * linea.cantidad,
    tasaIla: desglosaIla ? Number(linea.producto.impuesto_adicional_tasa) || 0 : 0,
  }))
}

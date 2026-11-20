// src/features/pos/utils/lineasImpuesto.ts
import type { LineaCarrito } from '@/features/pos/stores/carritoStore'
import type { TipoComprobante } from '@/features/pos/types'

// DL 825, art. 43 inciso final: la venta del comerciante minorista al consumidor no esta afecta
// al impuesto adicional. En la boleta el ILA no se desglosa, va dentro del precio. En la factura
// si, porque esa venta es a otro comercio.
export function lineasParaImpuestos(lineas: LineaCarrito[], tipoComprobante: TipoComprobante) {
  const desglosaIla = tipoComprobante === 'FACTURA'

  return lineas.map((linea) => {
    // los dos campos viajan juntos al documento: con uno solo el total no cuadraria
    const codigo = Number(linea.producto.impuesto_adicional_codigo) || 0
    const tasa = Number(linea.producto.impuesto_adicional_tasa) || 0

    return {
      subtotal: linea.producto.precio_venta * linea.cantidad,
      tasaIla: desglosaIla && codigo > 0 && tasa > 0 ? tasa : 0,
    }
  })
}

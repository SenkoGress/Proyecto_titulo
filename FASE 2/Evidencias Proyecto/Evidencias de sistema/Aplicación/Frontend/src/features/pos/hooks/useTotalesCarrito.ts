// src/features/pos/hooks/useTotalesCarrito.ts
import { useMemo } from 'react'
import { useCarritoStore } from '@/features/pos/stores/carritoStore'
import { tieneAlcohol } from '@/features/pos/utils/alcohol'
import { desglosarCarrito } from '@/features/pos/utils/totalCobrado'

// totales del ticket
export function useTotalesCarrito() {
  const lineas = useCarritoStore((estado) => estado.lineas)
  const metodoPago = useCarritoStore((estado) => estado.metodoPago)
  const tipoComprobante = useCarritoStore((estado) => estado.tipoComprobante)

  return useMemo(() => {
    // ley 20.956: el redondeo a la decena solo rige para pagos en efectivo
    const esEfectivo = metodoPago === 'EFECTIVO'

    // neto, iva, ila y redondeo. La misma funcion que usa el cobro por atajo
    const desglose = desglosarCarrito(lineas, metodoPago, tipoComprobante)

    // unidades totales
    const unidades = lineas.reduce((acumulado, linea) => acumulado + linea.cantidad, 0)

    return {
      ...desglose,
      subtotal: desglose.bruto,
      ajusteRedondeo: desglose.redondeo,
      aplicaRedondeo: esEfectivo,
      unidades,
      cantidadLineas: lineas.length,
      contieneAlcohol: tieneAlcohol(lineas),
    }
  }, [lineas, metodoPago, tipoComprobante])
}

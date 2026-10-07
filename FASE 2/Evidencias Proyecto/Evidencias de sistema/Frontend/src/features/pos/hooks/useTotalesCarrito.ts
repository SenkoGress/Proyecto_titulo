// src/features/pos/hooks/useTotalesCarrito.ts
import { useMemo } from 'react'
import { useCarritoStore } from '@/features/pos/stores/carritoStore'
import { desglosarImpuestos } from '@/shared/utils/impuestos'
import { tieneAlcohol } from '@/features/pos/utils/alcohol'

// totales del ticket
export function useTotalesCarrito() {
  const lineas = useCarritoStore((estado) => estado.lineas)
  const metodoPago = useCarritoStore((estado) => estado.metodoPago)

  return useMemo(() => {
    // ley 20.956: el redondeo a la decena solo rige para pagos en efectivo
    const esEfectivo = metodoPago === 'EFECTIVO'

    // neto, iva, ila y redondeo
    const desglose = desglosarImpuestos(
      lineas.map((linea) => ({
        subtotal: linea.producto.precio_venta * linea.cantidad,
        tasaIla: Number(linea.producto.impuesto_adicional_tasa) || 0,
      })),
      esEfectivo,
    )

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
  }, [lineas, metodoPago])
}

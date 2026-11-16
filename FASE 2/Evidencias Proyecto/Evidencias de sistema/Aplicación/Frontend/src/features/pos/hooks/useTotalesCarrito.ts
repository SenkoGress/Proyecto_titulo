// src/features/pos/hooks/useTotalesCarrito.ts
import { useMemo } from 'react'
import { useCarritoStore } from '@/features/pos/stores/carritoStore'
import { desglosarImpuestos } from '@/shared/utils/impuestos'
import { tieneAlcohol } from '@/features/pos/utils/alcohol'
import { lineasParaImpuestos } from '@/features/pos/utils/lineasImpuesto'

// totales del ticket
export function useTotalesCarrito() {
  const lineas = useCarritoStore((estado) => estado.lineas)
  const metodoPago = useCarritoStore((estado) => estado.metodoPago)
  const tipoComprobante = useCarritoStore((estado) => estado.tipoComprobante)

  return useMemo(() => {
    // ley 20.956: el redondeo a la decena solo rige para pagos en efectivo
    const esEfectivo = metodoPago === 'EFECTIVO'

    // neto, iva, ila y redondeo
    const desglose = desglosarImpuestos(
      lineasParaImpuestos(lineas, tipoComprobante),
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
  }, [lineas, metodoPago, tipoComprobante])
}

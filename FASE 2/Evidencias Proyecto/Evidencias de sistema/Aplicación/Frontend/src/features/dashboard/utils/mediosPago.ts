// src/features/dashboard/utils/mediosPago.ts
import type { MedioPagoDashboard } from '@/features/dashboard/types'

type Reparto = {
  cobros: MedioPagoDashboard[]
  devoluciones: MedioPagoDashboard[]
  totalCobrado: number
  totalDevuelto: number
  neto: number
}

// Una devolucion viene en este desglose con el total en negativo. En una torta no se puede dibujar
// una porcion negativa, y el porcentaje que manda el servidor divide cada medio por el total neto
// (las devoluciones ya restadas), asi que los de lo cobrado suman mas de cien. Se separan: la
// torta muestra lo que entro, y lo devuelto va aparte, que es lo que ademas se entiende leyendo.
export function repartirMediosPago(medios: MedioPagoDashboard[]): Reparto {
  const cobros = medios.filter((medio) => medio.total > 0)
  const devoluciones = medios.filter((medio) => medio.total < 0)
  const totalCobrado = cobros.reduce((suma, medio) => suma + medio.total, 0)
  const totalDevuelto = devoluciones.reduce((suma, medio) => suma + Math.abs(medio.total), 0)

  return { cobros, devoluciones, totalCobrado, totalDevuelto, neto: totalCobrado - totalDevuelto }
}

// el porcentaje sobre lo cobrado, para que las porciones de la torta sumen cien
export function porcentajeDeLoCobrado(monto: number, totalCobrado: number): number {
  if (totalCobrado <= 0) return 0
  return Math.round((monto / totalCobrado) * 100)
}

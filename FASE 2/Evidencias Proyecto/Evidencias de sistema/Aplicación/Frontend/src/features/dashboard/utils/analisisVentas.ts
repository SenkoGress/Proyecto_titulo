// src/features/dashboard/utils/analisisVentas.ts
import type { MedioPagoDashboard, PeriodoDashboard, TimelineDashboard } from '@/features/dashboard/types'

// el punto mas alto de la serie: "mejor dia" si es mensual, "mejor hora" si es diario
export type PuntoMaximo = {
  etiqueta: string
  monto: number
} | null

export function puntoMasAlto(timeline: TimelineDashboard): PuntoMaximo {
  if (timeline.data.length === 0) return null

  let indice = 0
  for (let i = 1; i < timeline.data.length; i++) {
    if (timeline.data[i] > timeline.data[indice]) indice = i
  }

  return { etiqueta: timeline.labels[indice], monto: timeline.data[indice] }
}

// como se llama el eje segun el periodo que se esta mirando
export function tituloSerie(periodo: PeriodoDashboard): string {
  if (periodo === 'diario') return 'Ventas por hora de hoy'
  if (periodo === 'mensual') return 'Ventas por dia del mes'
  return 'Ventas por mes'
}

export function tituloPunto(periodo: PeriodoDashboard): string {
  if (periodo === 'diario') return 'Hora punta'
  if (periodo === 'mensual') return 'Mejor dia'
  return 'Mejor mes'
}

// el medio de pago con mas monto acumulado
export function medioPreferido(medios: MedioPagoDashboard[]): MedioPagoDashboard | null {
  if (medios.length === 0) return null
  return medios.reduce((mayor, actual) => (actual.total > mayor.total ? actual : mayor))
}

// total de tickets del periodo, sumando los de cada punto de la serie
export function totalTransaccionesSerie(timeline: TimelineDashboard): number {
  return timeline.transacciones.reduce((suma, valor) => suma + valor, 0)
}

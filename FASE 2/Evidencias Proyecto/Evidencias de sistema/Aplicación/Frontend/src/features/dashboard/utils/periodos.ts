// src/features/dashboard/utils/periodos.ts
import type { PeriodoDashboard } from '@/features/dashboard/types'

// los unicos 3 periodos que sabe calcular el backend (no existe semanal)
export const PERIODOS: { valor: PeriodoDashboard; etiqueta: string; corto: string }[] = [
  { valor: 'diario', etiqueta: 'Hoy', corto: 'de hoy' },
  { valor: 'mensual', etiqueta: 'Este mes', corto: 'del mes' },
  { valor: 'historico', etiqueta: 'Historico', corto: 'historicas' },
]

export function etiquetaPeriodo(periodo: PeriodoDashboard): string {
  return PERIODOS.find((item) => item.valor === periodo)?.corto ?? ''
}

export function nombrePeriodo(periodo: PeriodoDashboard): string {
  return PERIODOS.find((item) => item.valor === periodo)?.etiqueta ?? ''
}

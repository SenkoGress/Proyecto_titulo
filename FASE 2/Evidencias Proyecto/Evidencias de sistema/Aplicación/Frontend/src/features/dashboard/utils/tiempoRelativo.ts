// src/features/dashboard/utils/tiempoRelativo.ts
import { parsearFechaBackend } from '@/shared/utils/fechaBackend'

// "hace 3 min", "hace 2 h", "hace 4 d"
export function haceCuanto(fechaTexto: string): string {
  const fecha = parsearFechaBackend(fechaTexto)
  if (!fecha) return 'Fecha invalida'

  const minutos = Math.floor((Date.now() - fecha.getTime()) / 60_000)

  if (minutos < 1) return 'recien'
  if (minutos < 60) return `hace ${minutos} min`

  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `hace ${horas} h`

  return `hace ${Math.floor(horas / 24)} d`
}

// dia y hora local de la venta
export function fechaHoraCorta(fechaTexto: string): string {
  const fecha = parsearFechaBackend(fechaTexto)
  if (!fecha) return '--:--'

  return fecha.toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

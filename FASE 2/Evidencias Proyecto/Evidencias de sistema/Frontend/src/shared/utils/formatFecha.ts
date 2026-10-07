// src/shared/utils/formatFecha.ts
import { parsearFechaBackend } from '@/shared/utils/fechaBackend'

// fecha del backend (viene en UTC) a formato chileno
export function formatFecha(fechaIso: string | null): string {
  if (!fechaIso) return 'Sin registro'

  const fecha = parsearFechaBackend(fechaIso)
  if (!fecha) return 'Fecha invalida'

  return fecha.toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })
}

// fecha sin hora ("2026-09-26"): se arma en local para que no se corra un dia
export function formatFechaSola(fechaTexto: string | null): string {
  if (!fechaTexto) return 'Sin registro'

  const soloFecha = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fechaTexto.trim())
  if (soloFecha) {
    const [, anio, mes, dia] = soloFecha
    return new Date(Number(anio), Number(mes) - 1, Number(dia)).toLocaleDateString('es-CL')
  }

  const fecha = parsearFechaBackend(fechaTexto)
  return fecha ? fecha.toLocaleDateString('es-CL') : 'Fecha invalida'
}

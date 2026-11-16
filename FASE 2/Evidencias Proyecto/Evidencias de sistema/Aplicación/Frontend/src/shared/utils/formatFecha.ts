// src/shared/utils/formatFecha.ts
import { parsearFechaBackend } from '@/shared/utils/fechaBackend'

// fecha del backend (viene en UTC) a formato chileno
export function formatFecha(fechaIso: string | null): string {
  if (!fechaIso) return 'Sin registro'

  const fecha = parsearFechaBackend(fechaIso)
  if (!fecha) return 'Fecha invalida'

  return fecha.toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })
}

// cuanto tiempo paso, para avisos donde la hora exacta importa menos que saber si fue recien o
// hace rato. La fecha exacta se deja en el tooltip, no se reemplaza
export function haceCuanto(fechaIso: string | null, ahora: Date = new Date()): string {
  if (!fechaIso) return 'nunca'

  const fecha = parsearFechaBackend(fechaIso)
  if (!fecha) return 'fecha invalida'

  const segundos = Math.floor((ahora.getTime() - fecha.getTime()) / 1000)

  // un reloj corrido deja la marca en el futuro, y "hace -3 minutos" seria peor que esto
  if (segundos < 60) return 'recien'

  const minutos = Math.floor(segundos / 60)
  if (minutos < 60) return minutos === 1 ? 'hace 1 minuto' : `hace ${minutos} minutos`

  const horas = Math.floor(minutos / 60)
  if (horas < 24) return horas === 1 ? 'hace 1 hora' : `hace ${horas} horas`

  const dias = Math.floor(horas / 24)
  if (dias === 1) return 'ayer'
  if (dias < 30) return `hace ${dias} dias`

  return `el ${fecha.toLocaleDateString('es-CL')}`
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

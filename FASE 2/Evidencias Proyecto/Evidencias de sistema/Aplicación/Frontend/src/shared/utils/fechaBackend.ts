// src/shared/utils/fechaBackend.ts

// el backend manda las fechas en UTC y sin zona
export function parsearFechaBackend(fechaTexto: string | null): Date | null {
  if (!fechaTexto) return null

  const texto = fechaTexto.trim()

  // ya trae zona horaria (ej. "2026-09-24T23:59:01.338Z"): se parsea directo
  const tieneZona = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(texto)
  const normalizado = tieneZona ? texto : `${texto.replace(' ', 'T')}Z`

  const fecha = new Date(normalizado)
  return Number.isNaN(fecha.getTime()) ? null : fecha
}

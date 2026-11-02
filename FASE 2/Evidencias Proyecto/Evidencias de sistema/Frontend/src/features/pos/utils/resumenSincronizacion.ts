// src/features/pos/utils/resumenSincronizacion.ts
import { isAxiosError } from 'axios'
import { obtenerMensajeError } from '@/lib/api/apiError'

// POST /pos/sync responde 500 cuando alguna venta no pudo subir, aunque otras si hayan subido.
// El detalle viene en result, y sin leerlo no se distingue una subida parcial de una que no
// subio nada
type DetalleSync = {
  synced_ids?: unknown
  failed_ids?: unknown
}

function cuantas(ids: unknown): number {
  return Array.isArray(ids) ? ids.length : 0
}

export function detalleSyncDelError(error: unknown): DetalleSync | null {
  if (!isAxiosError(error)) return null
  const cuerpo = error.response?.data as { result?: DetalleSync } | undefined
  if (!cuerpo?.result || !Array.isArray(cuerpo.result.failed_ids)) return null
  return cuerpo.result
}

// que mostrarle al dueño cuando la sincronizacion no termino limpia
export function resumenSincronizacion(error: unknown): string {
  const detalle = detalleSyncDelError(error)

  // sin detalle no se puede afirmar que subio algo
  if (!detalle) {
    return `${obtenerMensajeError(error)} Las ventas siguen guardadas en este equipo.`
  }

  const subieron = cuantas(detalle.synced_ids)
  const quedaron = cuantas(detalle.failed_ids)

  if (subieron === 0) {
    return quedaron === 1
      ? 'No subio la venta pendiente. Sigue guardada en este equipo.'
      : `No subio ninguna venta. Las ${quedaron} siguen guardadas en este equipo.`
  }

  const subida = subieron === 1 ? 'Subio 1' : `Subieron ${subieron}`
  const resto =
    quedaron === 1
      ? 'La otra sigue guardada aca y se sube al sincronizar de nuevo.'
      : `Las otras ${quedaron} siguen guardadas aca y se suben al sincronizar de nuevo.`

  return `${subida} de ${subieron + quedaron} ventas. ${resto}`
}

// src/features/ventas/utils/sincronizacionVenta.ts
import type { FilaVenta } from '@/features/ventas/utils/filaVenta'

// GET /pos/transactions trae sync_status, pero no sync_attempts: desde el frontend se sabe que la
// venta no esta en la nube, no si todavia le quedan intentos o si ya se detuvo. El conteo exacto
// de detenidas lo da el aviso de sincronizar (stopped_sales_count)

export function noSubio(venta: FilaVenta): boolean {
  return (venta.sync_status ?? '').toUpperCase() !== 'SYNCED'
}

export function contarSinSubir(ventas: FilaVenta[]): number {
  return ventas.filter(noSubio).length
}

export type EstadoNube = {
  texto: string
  tono: 'success' | 'warning' | 'error'
  detalle: string
}

export function estadoEnLaNube(venta: FilaVenta): EstadoNube {
  const estado = (venta.sync_status ?? '').toUpperCase()

  if (estado === 'SYNCED') {
    return { texto: 'En la nube', tono: 'success', detalle: 'La venta esta respaldada en la nube' }
  }

  if (estado === 'FAILED') {
    return {
      texto: 'No subio',
      tono: 'error',
      detalle: 'La nube rechazo esta venta. Sigue guardada en el equipo y puede necesitar revision',
    }
  }

  return {
    texto: 'Por subir',
    tono: 'warning',
    detalle: 'Todavia no viaja a la nube. Sigue guardada en el equipo',
  }
}

// que decirle al dueño cuando hay ventas que no estan arriba
export function avisoVentasSinSubir(cuantas: number): string | null {
  if (cuantas < 1) return null

  return cuantas === 1
    ? 'Hay 1 venta que no esta en la nube. Queda guardada en este equipo.'
    : `Hay ${cuantas} ventas que no estan en la nube. Quedan guardadas en este equipo.`
}

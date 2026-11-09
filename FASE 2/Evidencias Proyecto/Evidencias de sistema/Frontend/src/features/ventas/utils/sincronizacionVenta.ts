// src/features/ventas/utils/sincronizacionVenta.ts
import type { FilaVenta } from '@/features/ventas/utils/filaVenta'

export function noSubio(venta: FilaVenta): boolean {
  return (venta.sync_status ?? '').toUpperCase() !== 'SYNCED'
}

// el backend manda sync_detenida ya calculada para no copiar aca el tope de intentos
export function estaDetenida(venta: FilaVenta): boolean {
  return Number(venta.sync_detenida) === 1
}

export function contarSinSubir(ventas: FilaVenta[]): number {
  return ventas.filter(noSubio).length
}

export function contarDetenidas(ventas: FilaVenta[]): number {
  return ventas.filter(estaDetenida).length
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

  if (estaDetenida(venta)) {
    return {
      texto: 'Detenida',
      tono: 'error',
      detalle: `Agoto sus ${venta.sync_attempts} intentos y ya no se reintenta sola. Sigue guardada en el equipo`,
    }
  }

  if (estado === 'FAILED') {
    return {
      texto: 'No subio',
      tono: 'error',
      detalle: 'La nube rechazo esta venta. Lo vuelve a intentar en la proxima sincronizacion',
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

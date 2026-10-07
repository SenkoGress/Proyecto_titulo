// src/features/ventas/utils/resumenVentas.ts
import type { FilaVenta } from '@/features/ventas/utils/filaVenta'

export type ResumenVentas = {
  cantidadVentas: number
  cantidadDevoluciones: number
  totalVendido: number
  totalDevuelto: number
  neto: number
  unidades: number
  ticketPromedio: number
  sinSincronizar: number
}

// totales de lo que se esta viendo en pantalla, no de todo el historial
export function resumirVentas(filas: FilaVenta[]): ResumenVentas {
  const ventas = filas.filter((fila) => !fila.esDevolucion)
  const devoluciones = filas.filter((fila) => fila.esDevolucion)

  const totalVendido = ventas.reduce((suma, fila) => suma + fila.total, 0)
  const totalDevuelto = devoluciones.reduce((suma, fila) => suma + Math.abs(fila.total), 0)

  return {
    cantidadVentas: ventas.length,
    cantidadDevoluciones: devoluciones.length,
    totalVendido,
    totalDevuelto,
    neto: totalVendido - totalDevuelto,
    unidades: ventas.reduce((suma, fila) => suma + fila.unidades, 0),
    ticketPromedio: ventas.length > 0 ? Math.round(totalVendido / ventas.length) : 0,
    sinSincronizar: filas.filter((fila) => fila.sync_status !== 'SYNCED').length,
  }
}

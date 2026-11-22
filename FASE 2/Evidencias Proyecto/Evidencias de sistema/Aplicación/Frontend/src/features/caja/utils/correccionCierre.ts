// src/features/caja/utils/correccionCierre.ts
import type { CierreHistorial, SesionCaja } from '@/features/caja/types'

type Cierre = Pick<
  SesionCaja,
  'monto_real_efectivo' | 'diferencia_efectivo' | 'monto_corregido_efectivo' | 'diferencia_corregida' | 'estado'
>

// el conteo que vale hoy: el corregido si hubo correccion, y si no el original
export function conteoVigente(cierre: Cierre): number | null {
  if (cierre.monto_corregido_efectivo !== null && cierre.monto_corregido_efectivo !== undefined) {
    return cierre.monto_corregido_efectivo
  }
  return cierre.monto_real_efectivo ?? null
}

// la diferencia que vale hoy, con la misma regla
export function diferenciaVigente(cierre: Cierre): number | null {
  if (cierre.diferencia_corregida !== null && cierre.diferencia_corregida !== undefined) {
    return cierre.diferencia_corregida
  }
  return cierre.diferencia_efectivo ?? null
}

export function estaCorregido(cierre: Cierre): boolean {
  return cierre.monto_corregido_efectivo !== null && cierre.monto_corregido_efectivo !== undefined
}

// un turno abierto no se corrige: primero se cierra. El servidor responde 409 TURNO_ABIERTO
export function sePuedeCorregir(cierre: CierreHistorial, esAdmin: boolean): boolean {
  return esAdmin && cierre.estado === 'CERRADA'
}

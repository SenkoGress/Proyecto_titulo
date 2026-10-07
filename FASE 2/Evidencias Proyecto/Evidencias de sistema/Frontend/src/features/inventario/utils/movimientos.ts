// src/features/inventario/utils/movimientos.ts
import { env } from '@/config/env'
import type { MovimientoStock, TipoMovimiento } from '@/features/inventario/types'

type ColorChip = 'default' | 'success' | 'error' | 'warning' | 'info'

const NOMBRES: Record<TipoMovimiento, string> = {
  alta_inicial: 'Alta',
  ingreso_factura: 'Compra',
  venta: 'Venta',
  ajuste: 'Ajuste',
  ajuste_manual: 'Conteo',
  merma: 'Merma',
}

const COLORES: Record<TipoMovimiento, ColorChip> = {
  alta_inicial: 'info',
  ingreso_factura: 'success',
  venta: 'default',
  ajuste: 'warning',
  ajuste_manual: 'warning',
  merma: 'error',
}

export function nombreMovimiento(tipo: TipoMovimiento): string {
  return NOMBRES[tipo] ?? tipo
}

export function colorMovimiento(tipo: TipoMovimiento): ColorChip {
  return COLORES[tipo] ?? 'default'
}

// entradas y salidas del periodo que trae el historial
export function resumirMovimientos(movimientos: MovimientoStock[]) {
  let entradas = 0
  let salidas = 0

  for (const movimiento of movimientos) {
    if (movimiento.cambio > 0) entradas += movimiento.cambio
    else salidas += Math.abs(movimiento.cambio)
  }

  return { entradas, salidas, total: movimientos.length }
}

const PARECE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// el backend guarda el id del usuario en las ventas y un nombre en la ingesta
export function nombreRegistro(usuario: string | null): string {
  if (!usuario) return 'Sin registro'
  if (usuario === env.usuarioId) return env.cajeroNombre
  return PARECE_ID.test(usuario) ? 'Caja' : usuario
}

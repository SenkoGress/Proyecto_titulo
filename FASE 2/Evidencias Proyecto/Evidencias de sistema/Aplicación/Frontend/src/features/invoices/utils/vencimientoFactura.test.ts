// src/features/invoices/utils/vencimientoFactura.test.ts
import { describe, expect, it } from 'vitest'
import {
  diasParaVencer,
  faltaVencimiento,
  productosVencidos,
} from '@/features/invoices/utils/vencimientoFactura'

const HOY = new Date(2026, 10, 19, 15, 30) // 19 de noviembre de 2026, a media tarde

function item(descripcion: string, fecha: string | null, noVence = false) {
  return { descripcion, cantidad: 6, fecha_vencimiento: fecha, no_vence: noVence }
}

describe('vencimiento de los productos de una factura', () => {
  it('falta cuando no hay fecha ni marca de que no vence', () => {
    expect(faltaVencimiento({ fecha_vencimiento: null })).toBe(true)
    expect(faltaVencimiento({ fecha_vencimiento: '' })).toBe(true)
    expect(faltaVencimiento({ fecha_vencimiento: '2026-12-01' })).toBe(false)
    expect(faltaVencimiento({ fecha_vencimiento: null, no_vence: true })).toBe(false)
  })

  // el motor de lectura puede traer la fecha en otro formato: el servidor la rechazaria
  it('una fecha que no es AAAA-MM-DD de calendario no cuenta como declarada', () => {
    expect(faltaVencimiento({ fecha_vencimiento: '15/12/2026' })).toBe(true)
    expect(faltaVencimiento({ fecha_vencimiento: '2026-02-30' })).toBe(true)
    expect(productosVencidos([item('Fecha mal leida', '15/12/2020')], HOY)).toEqual([])
  })

  it('cuenta los dias de calendario sin importar la hora', () => {
    expect(diasParaVencer('2026-11-19', HOY)).toBe(0)
    expect(diasParaVencer('2026-11-18', HOY)).toBe(-1)
    expect(diasParaVencer('2026-12-04', HOY)).toBe(15)
  })

  it('nombra solo los vencidos: lo que vence hoy todavia se puede vender', () => {
    const vencidos = productosVencidos(
      [
        item('Yogur vencido ayer', '2026-11-18'),
        item('Leche que vence hoy', '2026-11-19'),
        item('Queso a quince dias', '2026-12-04'),
        item('Bolsa reutilizable', null, true),
      ],
      HOY,
    )

    expect(vencidos.map((v) => v.descripcion)).toEqual(['Yogur vencido ayer'])
    expect(vencidos[0].dias_restantes).toBe(-1)
  })
})

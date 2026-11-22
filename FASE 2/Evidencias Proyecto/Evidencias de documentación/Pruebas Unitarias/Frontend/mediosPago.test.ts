// src/features/dashboard/utils/mediosPago.test.ts
import { describe, expect, it } from 'vitest'
import { porcentajeDeLoCobrado, repartirMediosPago } from '@/features/dashboard/utils/mediosPago'
import type { MedioPagoDashboard } from '@/features/dashboard/types'

// el desglose tal como lo manda el servidor: la devolucion por transferencia viene en negativo, y
// los porcentajes estan calculados sobre el total neto
const desglose = [
  { metodo: 'EFECTIVO', total: 48430, cantidad: 12, porcentaje: 59 },
  { metodo: 'TRANSBANK', total: 22710, cantidad: 4, porcentaje: 27 },
  { metodo: 'TRANSFERENCIA', total: -3780, cantidad: 1, porcentaje: -5 },
] as MedioPagoDashboard[]

describe('repartirMediosPago', () => {
  it('deja las devoluciones fuera de lo cobrado', () => {
    const { cobros, devoluciones } = repartirMediosPago(desglose)

    expect(cobros.map((medio) => medio.metodo)).toEqual(['EFECTIVO', 'TRANSBANK'])
    expect(devoluciones.map((medio) => medio.metodo)).toEqual(['TRANSFERENCIA'])
  })

  it('suma lo cobrado, lo devuelto y lo que queda', () => {
    const { totalCobrado, totalDevuelto, neto } = repartirMediosPago(desglose)

    expect(totalCobrado).toBe(71140)
    expect(totalDevuelto).toBe(3780)
    expect(neto).toBe(67360)
  })

  it('sin devoluciones no cambia nada', () => {
    const { cobros, devoluciones, neto } = repartirMediosPago(desglose.slice(0, 2))

    expect(cobros).toHaveLength(2)
    expect(devoluciones).toHaveLength(0)
    expect(neto).toBe(71140)
  })

  it('un desglose vacio no revienta', () => {
    const { cobros, totalCobrado, neto } = repartirMediosPago([])

    expect(cobros).toEqual([])
    expect(totalCobrado).toBe(0)
    expect(neto).toBe(0)
  })
})

describe('porcentajeDeLoCobrado', () => {
  // el porcentaje del servidor divide por el total neto, asi que los de lo cobrado pasan de cien
  it('los porcentajes de lo cobrado suman cien', () => {
    const { cobros, totalCobrado } = repartirMediosPago(desglose)
    const suma = cobros.reduce((total, medio) => total + porcentajeDeLoCobrado(medio.total, totalCobrado), 0)

    expect(suma).toBe(100)
  })

  it('sin nada cobrado devuelve cero y no divide por cero', () => {
    expect(porcentajeDeLoCobrado(0, 0)).toBe(0)
    expect(porcentajeDeLoCobrado(5000, 0)).toBe(0)
  })
})

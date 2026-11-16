// src/features/pos/utils/pagoEnEfectivo.test.ts
import { describe, expect, it } from 'vitest'
import { calcularVuelto, desglosarVuelto } from '@/features/pos/utils/pagoEnEfectivo'

describe('calcularVuelto', () => {
  it('devuelve el vuelto cuando sobra', () => {
    expect(calcularVuelto(2500, 2300)).toEqual({ vuelto: 200, falta: 0, alcanza: true })
  })

  it('avisa cuanto falta cuando no alcanza', () => {
    expect(calcularVuelto(2000, 2300)).toEqual({ vuelto: 0, falta: 300, alcanza: false })
  })

  it('el pago justo alcanza y no deja vuelto', () => {
    expect(calcularVuelto(2300, 2300)).toEqual({ vuelto: 0, falta: 0, alcanza: true })
  })
})

describe('desglosarVuelto', () => {
  it('usa las piezas mas grandes primero', () => {
    expect(desglosarVuelto(1600)).toEqual([
      { valor: 1000, cantidad: 1 },
      { valor: 500, cantidad: 1 },
      { valor: 100, cantidad: 1 },
    ])
  })

  it('repite una denominacion cuando hace falta', () => {
    expect(desglosarVuelto(300)).toEqual([{ valor: 100, cantidad: 3 }])
  })

  it('no devuelve piezas cuando no hay vuelto', () => {
    expect(desglosarVuelto(0)).toEqual([])
  })

  it('con el redondeo de la Ley 20.956 el vuelto siempre cierra en monedas', () => {
    const piezas = desglosarVuelto(4660)
    const suma = piezas.reduce((t, p) => t + p.valor * p.cantidad, 0)
    expect(suma).toBe(4660)
  })
})

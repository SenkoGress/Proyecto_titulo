// src/features/pos/utils/pagoEnEfectivo.test.ts
import { describe, expect, it } from 'vitest'
import { faltaElMontoRecibido, calcularVuelto, desglosarVuelto } from '@/features/pos/utils/pagoEnEfectivo'

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

// en la prueba con usuarios se cobro en efectivo sin anotar con cuanto pagaba el cliente: el
// monto vivia en el componente y el boton de cobrar no lo veia
describe('faltaElMontoRecibido', () => {
  it('en efectivo, sin monto anotado, falta', () => {
    expect(faltaElMontoRecibido('EFECTIVO', 0, 2380)).toBe(true)
  })

  it('en efectivo, con menos de lo que vale, falta', () => {
    expect(faltaElMontoRecibido('EFECTIVO', 2000, 2380)).toBe(true)
  })

  it('en efectivo, con lo justo, no falta', () => {
    expect(faltaElMontoRecibido('EFECTIVO', 2380, 2380)).toBe(false)
  })

  it('en efectivo, con mas de lo que vale, no falta', () => {
    expect(faltaElMontoRecibido('EFECTIVO', 5000, 2380)).toBe(false)
  })

  it('con tarjeta no se anota nada: no falta', () => {
    expect(faltaElMontoRecibido('TRANSBANK', 0, 2380)).toBe(false)
    expect(faltaElMontoRecibido('MERCADOPAGO', 0, 2380)).toBe(false)
  })

  it('un ticket vacio no pide monto', () => {
    expect(faltaElMontoRecibido('EFECTIVO', 0, 0)).toBe(false)
  })
})

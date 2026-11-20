// src/features/pos/utils/errorVenta.test.ts
import { describe, expect, it } from 'vitest'
import { AxiosError, AxiosHeaders } from 'axios'
import {
  cobroSinVenta,
  emisorSinRutValido,
  esTurnoCerrado,
  faltaStock,
  productosSinStock,
} from '@/features/pos/utils/errorVenta'

function respuesta(status: number, data: unknown) {
  const error = new AxiosError('Request failed', 'ERR_BAD_REQUEST')
  error.response = { status, data, statusText: '', headers: {}, config: { headers: new AxiosHeaders() } }
  return error
}

describe('emisorSinRutValido', () => {
  it('reconoce el codigo del servidor', () => {
    expect(emisorSinRutValido(respuesta(400, { error: 'EMISOR_RUT_INVALIDO' }))).toBe(true)
  })

  it('no confunde el rut del cliente con el del local', () => {
    expect(emisorSinRutValido(respuesta(400, { error: 'RUT_RECEPTOR_INVALIDO' }))).toBe(false)
  })
})

describe('esTurnoCerrado', () => {
  it('reconoce el codigo del servidor', () => {
    expect(esTurnoCerrado(respuesta(400, { error: 'TURNO_CERRADO' }))).toBe(true)
  })

  it('no confunde otro error con el turno', () => {
    expect(esTurnoCerrado(respuesta(409, { error: 'STOCK_INSUFICIENTE' }))).toBe(false)
    expect(esTurnoCerrado(new Error('sin red'))).toBe(false)
  })
})

describe('cobroSinVenta', () => {
  it('distingue el cobro que si se devolvio del que no', () => {
    expect(cobroSinVenta(respuesta(500, { error: 'COBRO_DEVUELTO' }))).toBe(false)
    expect(cobroSinVenta(respuesta(500, { error: 'COBRO_SIN_VENTA' }))).toBe(true)
  })
})

describe('productosSinStock', () => {
  const faltante = { producto_id: 'p1', nombre: 'COLUN Leche Entera 1 L', disponible: 2, pedida: 5 }

  it('entrega el detalle que manda el servidor', () => {
    expect(productosSinStock(respuesta(409, { error: 'STOCK_INSUFICIENTE', productos: [faltante] }))).toHaveLength(1)
  })

  it('no entrega nada si el error es otro', () => {
    expect(productosSinStock(respuesta(400, { error: 'TURNO_CERRADO' }))).toEqual([])
  })

  it('un 409 sin el arreglo no revienta', () => {
    expect(productosSinStock(respuesta(409, { error: 'STOCK_INSUFICIENTE' }))).toEqual([])
  })

  it('dice cuanto se pide y cuanto queda', () => {
    expect(faltaStock(faltante)).toBe('COLUN Leche Entera 1 L: se piden 5 y quedan 2')
  })

  it('un stock negativo no se muestra en negativo', () => {
    expect(faltaStock({ ...faltante, disponible: -3 })).toContain('no queda ninguno')
  })
})

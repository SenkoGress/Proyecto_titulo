// src/features/ventas/utils/medioDevolucion.test.ts
import { describe, expect, it } from 'vitest'
import { AxiosError, AxiosHeaders } from 'axios'
import {
  esDevolucionEnCurso,
  esReversoManual,
  medioPorDefecto,
  mediosPosibles,
  mediosSinMaquina,
  nombreMedio,
} from '@/features/ventas/utils/medioDevolucion'

function respuesta(status: number, data: unknown) {
  const error = new AxiosError('Request failed', 'ERR_BAD_REQUEST')
  error.response = { status, data, statusText: '', headers: {}, config: { headers: new AxiosHeaders() } }
  return error
}

const valores = (opciones: { valor: string }[]) => opciones.map((opcion) => opcion.valor)

describe('mediosPosibles', () => {
  // el servidor rechaza con 400 MEDIO_DEVOLUCION_INVALIDO devolver en tarjeta una venta en efectivo
  it('una venta en efectivo solo se devuelve en efectivo', () => {
    expect(valores(mediosPosibles('EFECTIVO'))).toEqual(['EFECTIVO'])
  })

  it('una venta con tarjeta ofrece las tres formas, con la maquina primero', () => {
    expect(valores(mediosPosibles('TRANSBANK'))).toEqual(['TARJETA', 'EFECTIVO', 'TRANSFERENCIA'])
  })

  it('las otras pasarelas se tratan como tarjeta', () => {
    expect(valores(mediosPosibles('MERCADOPAGO'))).toEqual(['TARJETA', 'EFECTIVO', 'TRANSFERENCIA'])
    expect(valores(mediosPosibles('SUMUP'))).toEqual(['TARJETA', 'EFECTIVO', 'TRANSFERENCIA'])
  })

  it('cada opcion explica que pasa con la plata', () => {
    for (const opcion of mediosPosibles('TRANSBANK')) {
      expect(opcion.ayuda.length).toBeGreaterThan(20)
    }
  })
})

describe('medioPorDefecto', () => {
  // anular en la maquina es lo unico que deja la caja cuadrada sin que el cajero haga nada
  it('con tarjeta parte en la maquina', () => {
    expect(medioPorDefecto('TRANSBANK')).toBe('TARJETA')
  })

  it('en efectivo parte en efectivo', () => {
    expect(medioPorDefecto('EFECTIVO')).toBe('EFECTIVO')
  })
})

describe('mediosSinMaquina', () => {
  // cuando el terminal no pudo anular, la plata la entrega el cajero
  it('deja fuera la maquina', () => {
    expect(valores(mediosSinMaquina())).toEqual(['EFECTIVO', 'TRANSFERENCIA'])
  })
})

describe('esReversoManual', () => {
  it('reconoce el codigo del servidor', () => {
    expect(esReversoManual(respuesta(409, { error: 'REVERSO_MANUAL' }))).toBe(true)
  })

  it('no confunde otro rechazo', () => {
    expect(esReversoManual(respuesta(409, { error: 'DEVOLUCION_EN_CURSO' }))).toBe(false)
    expect(esReversoManual(respuesta(400, { error: 'TURNO_CERRADO' }))).toBe(false)
    expect(esReversoManual(new Error('sin red'))).toBe(false)
  })
})

describe('esDevolucionEnCurso', () => {
  it('reconoce el codigo del servidor', () => {
    expect(esDevolucionEnCurso(respuesta(409, { error: 'DEVOLUCION_EN_CURSO' }))).toBe(true)
  })

  it('no confunde el reverso manual', () => {
    expect(esDevolucionEnCurso(respuesta(409, { error: 'REVERSO_MANUAL' }))).toBe(false)
  })
})

describe('nombreMedio', () => {
  it('dice por donde salio la plata', () => {
    expect(nombreMedio('TARJETA')).toBe('anulado en la maquina')
    expect(nombreMedio('EFECTIVO')).toContain('gaveta')
    expect(nombreMedio('TRANSFERENCIA')).toBe('por transferencia')
  })

  // una devolucion anterior a la 1.0.6 no tiene el campo: no se inventa un medio
  it('sin medio registrado lo dice', () => {
    expect(nombreMedio(null)).toContain('sin registrar')
  })
})

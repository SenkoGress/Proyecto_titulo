// src/features/configuracion/utils/horarioAviso.test.ts
import { describe, expect, it } from 'vitest'
import { DIAS_AVISO, esDiaValido, esHoraValida, textoHorarioAviso } from '@/features/configuracion/utils/horarioAviso'

describe('DIAS_AVISO', () => {
  // el backend numera 1 lunes y 7 domingo, no como getDay() que parte en domingo 0
  it('va de 1 a 7 y el domingo es el 7', () => {
    expect(DIAS_AVISO.map((opcion) => opcion.valor)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(DIAS_AVISO[6].nombre).toBe('Domingo')
  })
})

describe('esHoraValida', () => {
  it('acepta HH:MM en 24 horas', () => {
    expect(esHoraValida('08:00')).toBe(true)
    expect(esHoraValida('23:59')).toBe(true)
    expect(esHoraValida('00:00')).toBe(true)
  })

  // el backend rechaza estos con 400, no conviene mandarlos
  it('rechaza lo que el backend no acepta', () => {
    expect(esHoraValida('25:00')).toBe(false)
    expect(esHoraValida('8:00')).toBe(false)
    expect(esHoraValida('08:60')).toBe(false)
    expect(esHoraValida('')).toBe(false)
  })
})

describe('esDiaValido', () => {
  it('acepta del 1 al 7', () => {
    expect(esDiaValido(1)).toBe(true)
    expect(esDiaValido(7)).toBe(true)
  })

  it('rechaza el 0 y el 8', () => {
    expect(esDiaValido(0)).toBe(false)
    expect(esDiaValido(8)).toBe(false)
  })
})

describe('textoHorarioAviso', () => {
  it('arma la frase con el dia en minuscula', () => {
    expect(textoHorarioAviso(1, '08:00')).toBe('El aviso sale cada lunes a las 08:00.')
    expect(textoHorarioAviso(7, '19:30')).toBe('El aviso sale cada domingo a las 19:30.')
  })

  // mientras el servidor no responda no hay horario, y suponer uno es peor que no mostrar nada
  it('no arma frase con datos que no existen', () => {
    expect(textoHorarioAviso(0, '08:00')).toBeNull()
    expect(textoHorarioAviso(1, '')).toBeNull()
  })
})

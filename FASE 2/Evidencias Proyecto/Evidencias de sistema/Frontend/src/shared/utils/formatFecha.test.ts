// src/shared/utils/formatFecha.test.ts
import { describe, expect, it } from 'vitest'
import { haceCuanto } from '@/shared/utils/formatFecha'

// el backend manda UTC sin zona, asi que las dos fechas se escriben igual
const AHORA = new Date('2026-11-09T12:00:00Z')

function hace(minutos: number): string {
  const fecha = new Date(AHORA.getTime() - minutos * 60_000)
  return fecha.toISOString().slice(0, 19).replace('T', ' ')
}

describe('haceCuanto', () => {
  it('sin fecha dice nunca, no una fecha inventada', () => {
    expect(haceCuanto(null, AHORA)).toBe('nunca')
  })

  it('lo de hace menos de un minuto es recien', () => {
    expect(haceCuanto(hace(0), AHORA)).toBe('recien')
  })

  it('singular y plural de los minutos', () => {
    expect(haceCuanto(hace(1), AHORA)).toBe('hace 1 minuto')
    expect(haceCuanto(hace(45), AHORA)).toBe('hace 45 minutos')
  })

  it('pasa a horas y a dias', () => {
    expect(haceCuanto(hace(60), AHORA)).toBe('hace 1 hora')
    expect(haceCuanto(hace(60 * 5), AHORA)).toBe('hace 5 horas')
    expect(haceCuanto(hace(60 * 24), AHORA)).toBe('ayer')
    expect(haceCuanto(hace(60 * 24 * 3), AHORA)).toBe('hace 3 dias')
  })

  it('pasado el mes muestra la fecha', () => {
    expect(haceCuanto(hace(60 * 24 * 45), AHORA)).toMatch(/^el \d/)
  })

  // el equipo del local puede tener el reloj corrido
  it('una marca en el futuro no dice hace menos tres minutos', () => {
    expect(haceCuanto(hace(-3), AHORA)).toBe('recien')
  })

  it('una fecha ilegible se avisa', () => {
    expect(haceCuanto('no es fecha', AHORA)).toBe('fecha invalida')
  })
})

// src/features/clima/utils/codigoClima.test.ts
import { describe, expect, it } from 'vitest'
import { avisoDelDia, describirClima } from '@/features/clima/utils/codigoClima'
import type { Clima } from '@/features/clima/types'

function clima(campos: Partial<Clima>): Clima {
  return {
    lugar: 'Valparaiso',
    temperatura: 18,
    maxima: 20,
    minima: 12,
    probabilidadLluvia: 0,
    codigo: 0,
    medidoA: new Date('2026-10-15T12:00:00'),
    ...campos,
  }
}

describe('describirClima', () => {
  it('traduce los codigos del servicio', () => {
    expect(describirClima(0).texto).toBe('Despejado')
    expect(describirClima(63).tipo).toBe('lluvia')
    expect(describirClima(95).tipo).toBe('tormenta')
  })

  // el servicio podria agregar codigos nuevos
  it('no se cae con un codigo desconocido', () => {
    expect(describirClima(999).texto).toBe('Sin dato')
  })
})

describe('avisoDelDia', () => {
  it('un dia normal no genera aviso', () => {
    expect(avisoDelDia(clima({}))).toBeNull()
  })

  it('avisa por calor y nombra los helados', () => {
    const aviso = avisoDelDia(clima({ maxima: 31 }))
    expect(aviso?.tono).toBe('calor')
    expect(aviso?.corto).toContain('helados')
  })

  it('avisa por frio usando la minima', () => {
    expect(avisoDelDia(clima({ minima: 5 }))?.tono).toBe('frio')
  })

  it('avisa por lluvia probable', () => {
    expect(avisoDelDia(clima({ probabilidadLluvia: 80 }))?.tono).toBe('lluvia')
  })

  // con calor y lluvia juntos manda el calor, que es lo que mueve la venta
  it('prioriza el calor sobre la lluvia', () => {
    expect(avisoDelDia(clima({ maxima: 30, probabilidadLluvia: 90 }))?.tono).toBe('calor')
  })

  it('no avisa por calor si la maxima queda justo abajo del limite', () => {
    expect(avisoDelDia(clima({ maxima: 27 }))).toBeNull()
  })
})

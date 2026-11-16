// src/features/pos/utils/esperaPago.test.ts
import { describe, expect, it } from 'vitest'
import { avisoEspera, esperaEnMaquina } from '@/features/pos/utils/esperaPago'

describe('esperaEnMaquina', () => {
  it('el efectivo no espera a ninguna maquina', () => {
    expect(esperaEnMaquina('EFECTIVO')).toBe(false)
  })

  it('las pasarelas si', () => {
    expect(esperaEnMaquina('TRANSBANK')).toBe(true)
    expect(esperaEnMaquina('MERCADOPAGO')).toBe(true)
    expect(esperaEnMaquina('SUMUP')).toBe(true)
  })
})

describe('avisoEspera', () => {
  it('nombra la maquina de cada pasarela', () => {
    expect(avisoEspera('TRANSBANK', 0)).toContain('terminal Transbank')
    expect(avisoEspera('MERCADOPAGO', 0)).toContain('Mercado Pago Point')
    expect(avisoEspera('SUMUP', 0)).toContain('lector SumUp')
  })

  it('al principio no abruma con el reloj', () => {
    expect(avisoEspera('TRANSBANK', 5)).not.toContain('segundos')
  })

  it('despues de veinte segundos muestra cuanto lleva', () => {
    expect(avisoEspera('TRANSBANK', 25)).toContain('Van 25 segundos')
  })

  it('pasado el minuto explica hasta cuando va a esperar', () => {
    expect(avisoEspera('TRANSBANK', 75)).toContain('un par de minutos')
  })

  it('el cobro pide pasar la tarjeta y la devolucion avisa que esta devolviendo', () => {
    expect(avisoEspera('TRANSBANK', 0, 'COBRO')).toContain('que la pase')
    expect(avisoEspera('TRANSBANK', 0, 'DEVOLUCION')).toContain('devolviendo el dinero')
  })

  it('un medio de pago que no conoce no deja la frase sin sujeto', () => {
    expect(avisoEspera('OTRO', 0)).toContain('La maquina esta esperando')
  })
})

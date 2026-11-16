// src/features/pos/utils/metodosVisibles.test.ts
import { describe, expect, it } from 'vitest'
import { metodoElegible, metodosVisibles } from '@/features/pos/utils/metodosVisibles'

const valores = (configuradas?: Parameters<typeof metodosVisibles>[0]) =>
  metodosVisibles(configuradas).map((metodo) => metodo.valor)

const etiquetas = (configuradas?: Parameters<typeof metodosVisibles>[0]) =>
  metodosVisibles(configuradas).map((metodo) => metodo.etiqueta)

describe('metodosVisibles', () => {
  it('sin saber que tiene el local no esconde ninguna maquina', () => {
    expect(valores()).toContain('TRANSBANK')
    expect(valores()).toContain('MERCADOPAGO')
    expect(valores()).toContain('SUMUP')
  })

  it('RutPay no se ofrece sola, porque aprueba sin cobrarle a nadie', () => {
    expect(valores()).not.toContain('RUTPAY')
    expect(valores([])).not.toContain('RUTPAY')
  })

  it('con una maquina configurada quedan dos botones', () => {
    expect(valores(['TRANSBANK'])).toEqual(['EFECTIVO', 'TRANSBANK'])
  })

  it('con una sola maquina el boton dice Tarjeta, no la marca', () => {
    expect(etiquetas(['MERCADOPAGO'])).toEqual(['Efectivo', 'Tarjeta'])
  })

  it('con dos maquinas cada boton conserva su marca', () => {
    expect(etiquetas(['TRANSBANK', 'MERCADOPAGO'])).toEqual(['Efectivo', 'Transbank', 'Mercado Pago'])
  })

  it('el efectivo siempre esta, aunque el servidor no lo nombre', () => {
    expect(valores(['SUMUP'])[0]).toBe('EFECTIVO')
  })

  it('si el local configura RutPay a proposito, se muestra', () => {
    expect(valores(['RUTPAY'])).toEqual(['EFECTIVO', 'RUTPAY'])
  })
})

describe('metodoElegible', () => {
  it('deja el metodo elegido si sigue visible', () => {
    expect(metodoElegible('TRANSBANK', metodosVisibles(['TRANSBANK']))).toBe('TRANSBANK')
  })

  it('vuelve a efectivo si la maquina elegida dejo de estar', () => {
    expect(metodoElegible('SUMUP', metodosVisibles(['TRANSBANK']))).toBe('EFECTIVO')
  })
})

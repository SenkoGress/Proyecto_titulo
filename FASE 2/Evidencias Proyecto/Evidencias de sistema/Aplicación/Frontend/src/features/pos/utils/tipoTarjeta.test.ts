// src/features/pos/utils/tipoTarjeta.test.ts
import { describe, expect, it } from 'vitest'
import { esConTarjeta, nombreTipoTarjeta, tipoTarjetaParaCobro } from '@/features/pos/utils/tipoTarjeta'

describe('esConTarjeta', () => {
  it('las pasarelas de tarjeta si', () => {
    expect(esConTarjeta('TRANSBANK')).toBe(true)
    expect(esConTarjeta('MERCADOPAGO')).toBe(true)
    expect(esConTarjeta('SUMUP')).toBe(true)
  })

  // el efectivo no tiene tarjeta, y RutPay aprueba desde el telefono del cliente
  it('el efectivo y RutPay no', () => {
    expect(esConTarjeta('EFECTIVO')).toBe(false)
    expect(esConTarjeta('RUTPAY')).toBe(false)
  })
})

describe('tipoTarjetaParaCobro', () => {
  it('con tarjeta viaja lo que marco el cajero', () => {
    expect(tipoTarjetaParaCobro('TRANSBANK', 'DEBITO')).toBe('DEBITO')
    expect(tipoTarjetaParaCobro('SUMUP', 'CREDITO')).toBe('CREDITO')
  })

  it('sin marcar no se manda nada', () => {
    expect(tipoTarjetaParaCobro('TRANSBANK', null)).toBeUndefined()
  })

  // el servidor lo descarta igual: mandarlo solo ensucia la peticion
  it('en efectivo no se manda, aunque quedara marcado de una venta anterior', () => {
    expect(tipoTarjetaParaCobro('EFECTIVO', 'CREDITO')).toBeUndefined()
    expect(tipoTarjetaParaCobro('RUTPAY', 'DEBITO')).toBeUndefined()
  })
})

describe('nombreTipoTarjeta', () => {
  it('traduce lo que guarda el servidor', () => {
    expect(nombreTipoTarjeta('CREDITO')).toBe('Credito')
    expect(nombreTipoTarjeta('DEBITO')).toBe('Debito')
  })

  // una venta anterior a la 1.0.6 no lo trae: no se muestra nada en vez de inventarlo
  it('sin tipo devuelve nulo', () => {
    expect(nombreTipoTarjeta(null)).toBeNull()
    expect(nombreTipoTarjeta(undefined)).toBeNull()
    expect(nombreTipoTarjeta('OTRA_COSA')).toBeNull()
  })
})

// src/features/ventas/utils/reversoManual.test.ts
import { describe, expect, it } from 'vitest'
import { avisoReversoManual, hayQueDevolverAMano } from '@/features/ventas/utils/reversoManual'

describe('reverso manual', () => {
  it('sin pago con tarjeta no hay nada que devolver a mano', () => {
    expect(hayQueDevolverAMano(null)).toBe(false)
    expect(avisoReversoManual(null)).toBeNull()
  })

  it('un reverso que si se hizo en la maquina no pide nada al cajero', () => {
    const reverso = { pasarela: 'MercadoPago', monto: -1890, manual: false }
    expect(hayQueDevolverAMano(reverso)).toBe(false)
    expect(avisoReversoManual(reverso)).toBeNull()
  })

  it('un reverso pendiente dice cuanto y como devolverlo', () => {
    const aviso = avisoReversoManual({ pasarela: 'RutPay', monto: -1890, manual: true })
    expect(aviso).toContain('$1.890')
    expect(aviso).toContain('efectivo o por transferencia')
    expect(aviso).toContain('RutPay')
  })

  it('el monto se muestra en positivo aunque el reverso venga en negativo', () => {
    expect(avisoReversoManual({ pasarela: 'Transbank', monto: -2500, manual: true })).not.toContain('-')
  })
})

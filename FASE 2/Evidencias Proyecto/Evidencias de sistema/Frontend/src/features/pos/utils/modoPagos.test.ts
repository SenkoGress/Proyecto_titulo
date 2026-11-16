// src/features/pos/utils/modoPagos.test.ts
import { describe, expect, it } from 'vitest'
import { avisoModoPagos, leyendaVoucher } from '@/features/pos/utils/modoPagos'

describe('avisoModoPagos', () => {
  it('en produccion no avisa nada', () => {
    expect(avisoModoPagos('produccion')).toBeNull()
  })

  it('sin saber el modo no inventa un aviso', () => {
    expect(avisoModoPagos(undefined)).toBeNull()
  })

  it('el modo simulado avisa en rojo que no se cobra', () => {
    const aviso = avisoModoPagos('simulado')
    expect(aviso?.tono).toBe('error')
    expect(aviso?.detalle).toContain('sin cobrar')
  })

  it('el sandbox avisa en amarillo que el dinero no es real', () => {
    const aviso = avisoModoPagos('sandbox')
    expect(aviso?.tono).toBe('warning')
    expect(aviso?.detalle).toContain('dinero real')
  })
})

describe('leyendaVoucher', () => {
  it('el comprobante de produccion no lleva leyenda', () => {
    expect(leyendaVoucher('produccion')).toBeNull()
    expect(leyendaVoucher(undefined)).toBeNull()
  })

  it('el comprobante de una venta simulada dice que no se cobro', () => {
    expect(leyendaVoucher('simulado')).toContain('NO SE COBRO')
  })

  it('el de sandbox dice que es de prueba', () => {
    expect(leyendaVoucher('sandbox')).toContain('PRUEBA')
  })
})

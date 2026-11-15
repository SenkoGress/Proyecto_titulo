// src/features/pos/utils/lineasImpuesto.test.ts
import { describe, expect, it } from 'vitest'
import { lineasParaImpuestos } from '@/features/pos/utils/lineasImpuesto'
import { desglosarImpuestos } from '@/shared/utils/impuestos'
import type { LineaCarrito } from '@/features/pos/stores/carritoStore'

// una cerveza de 10.000 con el impuesto de cervezas, 20,5%
const cerveza = [
  { producto: { precio_venta: 10000, impuesto_adicional_tasa: 20.5 }, cantidad: 1 },
] as unknown as LineaCarrito[]

describe('lineasParaImpuestos', () => {
  it('la boleta no desglosa el impuesto adicional', () => {
    expect(lineasParaImpuestos(cerveza, 'BOLETA')).toEqual([{ subtotal: 10000, tasaIla: 0 }])
  })

  it('la factura si lo desglosa, porque esa venta es a otro comercio', () => {
    expect(lineasParaImpuestos(cerveza, 'FACTURA')).toEqual([{ subtotal: 10000, tasaIla: 20.5 }])
  })

  it('un producto sin impuesto adicional queda en cero en los dos casos', () => {
    const pan = [
      { producto: { precio_venta: 2190, impuesto_adicional_tasa: null }, cantidad: 2 },
    ] as unknown as LineaCarrito[]
    expect(lineasParaImpuestos(pan, 'BOLETA')).toEqual([{ subtotal: 4380, tasaIla: 0 }])
    expect(lineasParaImpuestos(pan, 'FACTURA')).toEqual([{ subtotal: 4380, tasaIla: 0 }])
  })
})

describe('lo que ve el cliente', () => {
  const totalDe = (d: { bruto: number }) => d.bruto

  it('el total no cambia entre boleta y factura: solo cambia el desglose', () => {
    const boleta = desglosarImpuestos(lineasParaImpuestos(cerveza, 'BOLETA'), false)
    const factura = desglosarImpuestos(lineasParaImpuestos(cerveza, 'FACTURA'), false)
    expect(totalDe(boleta)).toBe(totalDe(factura))
  })

  it('en la boleta el neto sale de dividir por 1,19, sin restar el impuesto adicional', () => {
    const boleta = desglosarImpuestos(lineasParaImpuestos(cerveza, 'BOLETA'), false)
    expect(boleta.ila).toBe(0)
    expect(boleta.neto).toBe(Math.round(10000 / 1.19))
  })

  it('en la factura el impuesto adicional aparece y el neto baja', () => {
    const factura = desglosarImpuestos(lineasParaImpuestos(cerveza, 'FACTURA'), false)
    const boleta = desglosarImpuestos(lineasParaImpuestos(cerveza, 'BOLETA'), false)
    expect(factura.ila).toBeGreaterThan(0)
    expect(factura.neto).toBeLessThan(boleta.neto)
  })
})

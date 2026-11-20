// src/features/pos/utils/lineasImpuesto.test.ts
import { describe, expect, it } from 'vitest'
import { lineasParaImpuestos } from '@/features/pos/utils/lineasImpuesto'
import { desglosarImpuestos } from '@/shared/utils/impuestos'
import type { LineaCarrito } from '@/features/pos/stores/carritoStore'

// una cerveza de 10.000 con el impuesto de cervezas, codigo 26 y 20,5%
const cerveza = [
  {
    producto: { precio_venta: 10000, impuesto_adicional_codigo: 26, impuesto_adicional_tasa: 20.5 },
    cantidad: 1,
  },
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
      {
        producto: { precio_venta: 2190, impuesto_adicional_codigo: null, impuesto_adicional_tasa: null },
        cantidad: 2,
      },
    ] as unknown as LineaCarrito[]
    expect(lineasParaImpuestos(pan, 'BOLETA')).toEqual([{ subtotal: 4380, tasaIla: 0 }])
    expect(lineasParaImpuestos(pan, 'FACTURA')).toEqual([{ subtotal: 4380, tasaIla: 0 }])
  })

  it('con tasa pero sin codigo no se desglosa, igual que en el documento', () => {
    const aMedias = [
      { producto: { precio_venta: 10000, impuesto_adicional_tasa: 20.5 }, cantidad: 1 },
    ] as unknown as LineaCarrito[]
    expect(lineasParaImpuestos(aMedias, 'FACTURA')).toEqual([{ subtotal: 10000, tasaIla: 0 }])
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

// la pantalla de cobro usa la misma regla que la boleta (dte-emitter.service.ts)
describe('el desglose de la caja cuadra igual que el documento', () => {
  it('con varias lineas, neto + iva + ila da el total y el neto se saca una vez sobre lo afecto', () => {
    const d = desglosarImpuestos(
      [
        { subtotal: 1234, tasaIla: 0 },
        { subtotal: 2397, tasaIla: 0 },
        { subtotal: 1005, tasaIla: 0 },
      ],
      false,
    )
    expect(d.neto).toBe(Math.round(4636 / 1.19))
    expect(d.neto + d.iva + d.ila).toBe(4636)
  })

  it('con impuesto adicional tambien cuadra', () => {
    const d = desglosarImpuestos([{ subtotal: 5970, tasaIla: 20.5 }, { subtotal: 1234, tasaIla: 0 }], false)
    expect(d.ila).toBeGreaterThan(0)
    expect(d.neto + d.iva + d.ila).toBe(7204)
  })

  it('en efectivo el redondeo baja el 5 y no toca el desglose', () => {
    const d = desglosarImpuestos([{ subtotal: 1005, tasaIla: 0 }], true)
    expect(d.total).toBe(1000)
    expect(d.neto + d.iva).toBe(1005)
  })
})

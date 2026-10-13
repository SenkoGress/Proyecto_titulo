// src/features/invoices/utils/lecturaFactura.test.ts
import { describe, expect, it } from 'vitest'
import { faltaElFolio, noSePudoLeer } from '@/features/invoices/utils/lecturaFactura'
import type { ItemFactura, PrevisualizacionFactura } from '@/features/invoices/types'

function preview(campos: Partial<PrevisualizacionFactura>): PrevisualizacionFactura {
  return {
    folio_factura: 'FAC-11354',
    items: [{ descripcion: 'Yogurt' } as ItemFactura],
    total_factura: 28182,
    ...campos,
  } as PrevisualizacionFactura
}

describe('noSePudoLeer', () => {
  // gemini responde 200 con todo vacio cuando la foto no se entiende
  it('detecta la respuesta vacia que deja una foto ilegible', () => {
    const vacia = preview({ folio_factura: null, items: [], total_factura: 0 })
    expect(noSePudoLeer(vacia)).toBe(true)
  })

  it('no se confunde con una factura que si se leyo', () => {
    expect(noSePudoLeer(preview({}))).toBe(false)
  })

  it('aguanta que items venga sin definir', () => {
    expect(noSePudoLeer(preview({ items: undefined }))).toBe(true)
  })
})

describe('faltaElFolio', () => {
  it('avisa cuando se leyeron productos pero no el numero de factura', () => {
    expect(faltaElFolio(preview({ folio_factura: null }))).toBe(true)
  })

  it('no avisa si el folio esta', () => {
    expect(faltaElFolio(preview({}))).toBe(false)
  })

  // si no se leyo nada manda el otro aviso, no este
  it('no avisa cuando no se pudo leer nada', () => {
    const vacia = preview({ folio_factura: null, items: [] })
    expect(faltaElFolio(vacia)).toBe(false)
  })
})

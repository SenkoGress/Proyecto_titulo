// src/shared/utils/ila.test.ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ILA, TASA_ILA, esAlcohol, esAnalcoholicaConIla, esAzucarAlta } from '@/shared/utils/ila'
import type { ConImpuesto } from '@/shared/utils/ila'

const producto = (codigo: number): ConImpuesto => ({
  impuesto_adicional_codigo: codigo,
  impuesto_adicional_tasa: TASA_ILA[codigo] ?? null,
})

type ProductoSembrado = {
  nombre: string
  impuesto_adicional_codigo: number
  impuesto_adicional_tasa: number
}

const catalogo = JSON.parse(
  readFileSync(resolve(__dirname, '../../../../semillas/catalogo-demo.json'), 'utf-8'),
) as { productos: ProductoSembrado[] }

describe('el aviso de azucar alta', () => {
  it('solo sale en el codigo 271, que es el de elevado contenido de azucares', () => {
    expect(esAzucarAlta(producto(ILA.AZUCAR_ALTA))).toBe(true)
  })

  it('no sale en una bebida sin azucar, que va en el codigo 27', () => {
    expect(esAzucarAlta(producto(ILA.ANALCOHOLICA))).toBe(false)
  })

  it('no sale en el alcohol ni en un producto sin impuesto adicional', () => {
    expect(esAzucarAlta(producto(ILA.CERVEZAS))).toBe(false)
    expect(esAzucarAlta(producto(0))).toBe(false)
  })

  it('las dos analcoholicas siguen reconociendose como tales', () => {
    expect(esAnalcoholicaConIla(producto(ILA.ANALCOHOLICA))).toBe(true)
    expect(esAnalcoholicaConIla(producto(ILA.AZUCAR_ALTA))).toBe(true)
    expect(esAnalcoholicaConIla(producto(ILA.LICORES))).toBe(false)
  })

  it('el alcohol se reconoce por sus tres codigos', () => {
    expect(esAlcohol(producto(ILA.VINOS))).toBe(true)
    expect(esAlcohol(producto(ILA.CERVEZAS))).toBe(true)
    expect(esAlcohol(producto(ILA.LICORES))).toBe(true)
    expect(esAlcohol(producto(ILA.AZUCAR_ALTA))).toBe(false)
  })
})

// tabla del formato DTE del SII, version 2.5 (2026-02): el codigo va al documento tributario
describe('los codigos son los del SII', () => {
  it('cada codigo es el de la tabla oficial', () => {
    expect(ILA).toEqual({ ANALCOHOLICA: 27, AZUCAR_ALTA: 271, VINOS: 25, CERVEZAS: 26, LICORES: 24 })
  })

  it('ningun producto usa el 28, que en el SII es el impuesto al diesel', () => {
    expect(catalogo.productos.some((p) => p.impuesto_adicional_codigo === 28)).toBe(false)
  })
})

describe('el catalogo de demostracion', () => {
  const conIla = catalogo.productos.filter((p) => p.impuesto_adicional_codigo)

  it('cada producto lleva la tasa que la ley fija para su codigo', () => {
    for (const p of conIla) {
      expect(
        { nombre: p.nombre, tasa: p.impuesto_adicional_tasa },
        `${p.nombre} tiene codigo ${p.impuesto_adicional_codigo}`,
      ).toEqual({ nombre: p.nombre, tasa: TASA_ILA[p.impuesto_adicional_codigo] })
    }
  })

  it('ninguna bebida sin azucar queda marcada como azucar alta', () => {
    const sinAzucar = conIla.filter((p) => /zero|light|sin azucar/i.test(p.nombre))
    expect(sinAzucar.length).toBeGreaterThan(0)
    for (const p of sinAzucar) {
      expect(esAzucarAlta(p), `${p.nombre} no deberia salir como azucar alta`).toBe(false)
    }
  })

  it('estan cubiertos los tres tramos de alcohol y azucar para la demostracion', () => {
    const codigos = new Set(conIla.map((p) => p.impuesto_adicional_codigo))
    expect(codigos).toContain(ILA.AZUCAR_ALTA)
    expect(codigos).toContain(ILA.CERVEZAS)
    expect(codigos).toContain(ILA.LICORES)
  })
})

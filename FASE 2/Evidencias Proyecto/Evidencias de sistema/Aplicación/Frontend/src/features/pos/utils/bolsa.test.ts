// src/features/pos/utils/bolsa.test.ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SKU_BOLSA } from '@/features/pos/utils/bolsa'

type ProductoSembrado = { sku: string; nombre: string; activo: number }

// el boton de la bolsa busca el producto por su sku: si la semilla cambia y nadie actualiza la
// constante, el boton queda apagado en toda instalacion limpia y no se nota hasta la demo
const catalogo = JSON.parse(
  readFileSync(resolve(__dirname, '../../../../../semillas/catalogo-demo.json'), 'utf-8'),
) as { productos: ProductoSembrado[] }

describe('la bolsa del catalogo de demostracion', () => {
  it('existe un producto con el sku que busca el boton', () => {
    expect(catalogo.productos.map((p) => p.sku)).toContain(SKU_BOLSA)
  })

  it('esta activa, si no el boton sale deshabilitado', () => {
    const bolsa = catalogo.productos.find((p) => p.sku === SKU_BOLSA)
    expect(bolsa?.activo).toBe(1)
  })

  it('nombra la ley 21.100, que es la de las bolsas plasticas en el comercio', () => {
    const bolsa = catalogo.productos.find((p) => p.sku === SKU_BOLSA)
    expect(bolsa?.nombre).toContain('21.100')
  })

  it('hay una sola bolsa en el catalogo', () => {
    expect(catalogo.productos.filter((p) => /bolsa/i.test(p.nombre))).toHaveLength(1)
  })
})

// src/features/dashboard/utils/sugerencias.test.ts
import { describe, expect, it } from 'vitest'
import {
  armarSugerencias,
  sugerenciasPorRotacion,
  sugerenciasPorVencimiento,
} from '@/features/dashboard/utils/sugerencias'
import type { ProductoVencimiento } from '@/features/inventario/types'
import type { VelocidadProducto } from '@/features/replenishment/types'

function velocidad(campos: Partial<VelocidadProducto>): VelocidadProducto {
  return {
    productId: 'p1',
    sku: 'SKU-1',
    nombre: 'Monster 473ml',
    stockActual: 3,
    stockMinimo: 15,
    velocityDaily: 0.1,
    daysOfInventory: 30,
    reorderPoint: 16,
    isUnderStock: true,
    isAgotado: false,
    ...campos,
  } as VelocidadProducto
}

function vencimiento(campos: Partial<ProductoVencimiento>): ProductoVencimiento {
  return {
    id: 'v1',
    nombre: 'Leche Colun 1L',
    dias_restantes: 10,
    unidades_por_vencer: 12,
    ...campos,
  } as ProductoVencimiento
}

describe('sugerenciasPorRotacion', () => {
  it('sugiere reponer lo que se vende y esta bajo el punto de reorden', () => {
    const r = sugerenciasPorRotacion([velocidad({})])
    expect(r).toHaveLength(1)
    expect(r[0].tipo).toBe('reponer')
    expect(r[0].motivo).toContain('Quedan 3')
  })

  // tener poco stock de algo que no se vende no es urgente, es stock muerto
  it('no sugiere nada si el producto no se vende', () => {
    expect(sugerenciasPorRotacion([velocidad({ velocityDaily: 0 })])).toHaveLength(0)
  })

  it('no sugiere nada si todavia hay stock sobre el punto de reorden', () => {
    expect(sugerenciasPorRotacion([velocidad({ isUnderStock: false })])).toHaveLength(0)
  })

  it('avisa distinto cuando ya esta agotado', () => {
    expect(sugerenciasPorRotacion([velocidad({ isAgotado: true })])[0].motivo).toContain('Agotado')
  })
})

describe('sugerenciasPorVencimiento', () => {
  it('sugiere liquidar lo que vence pronto y tiene stock', () => {
    const r = sugerenciasPorVencimiento([vencimiento({})])
    expect(r[0].tipo).toBe('liquidar')
    expect(r[0].motivo).toBe('12 un. vencen en 10 dias')
  })

  // un producto vencido no se promociona, se retira: lo exige el D.S. 977/96
  it('deja fuera lo que ya vencio', () => {
    expect(sugerenciasPorVencimiento([vencimiento({ dias_restantes: -4 })])).toHaveLength(0)
  })

  it('deja fuera lo que vence lejos', () => {
    expect(sugerenciasPorVencimiento([vencimiento({ dias_restantes: 55 })])).toHaveLength(0)
  })

  // sin unidades no hay nada que liquidar, aunque la fecha apriete
  it('deja fuera lo que no tiene stock por vencer', () => {
    expect(sugerenciasPorVencimiento([vencimiento({ unidades_por_vencer: 0 })])).toHaveLength(0)
    expect(sugerenciasPorVencimiento([vencimiento({ unidades_por_vencer: null })])).toHaveLength(0)
  })
})

describe('armarSugerencias', () => {
  it('pone primero lo mas apretado', () => {
    const r = armarSugerencias(
      [velocidad({ stockActual: 9, isUnderStock: true })],
      [vencimiento({ dias_restantes: 2 })],
    )
    expect(r[0].tipo).toBe('liquidar')
  })

  it('sin datos no inventa sugerencias', () => {
    expect(armarSugerencias([], [])).toEqual([])
  })
})

// src/features/inventario/utils/categoriasExistentes.test.ts
import { describe, expect, it } from 'vitest'
import { categoriasExistentes } from '@/features/inventario/utils/categoriasExistentes'
import type { ProductoInventario } from '@/features/inventario/types'

function producto(categoria: string | null): ProductoInventario {
  return { categoria } as ProductoInventario
}

describe('categoriasExistentes', () => {
  it('no repite una categoria usada por varios productos', () => {
    expect(categoriasExistentes([producto('Snacks'), producto('Snacks')])).toEqual(['Snacks'])
  })

  it('deja fuera las vacias y las que son solo espacios', () => {
    expect(categoriasExistentes([producto(null), producto('   '), producto('Bebidas')]))
      .toEqual(['Bebidas'])
  })

  it('quita los espacios de los costados', () => {
    expect(categoriasExistentes([producto('  Abarrotes  ')])).toEqual(['Abarrotes'])
  })

  it('ordena respetando los acentos del espanol', () => {
    expect(categoriasExistentes([producto('Snacks'), producto('Lácteos'), producto('Abarrotes')]))
      .toEqual(['Abarrotes', 'Lácteos', 'Snacks'])
  })

  it('devuelve una lista vacia cuando no hay ninguna', () => {
    expect(categoriasExistentes([])).toEqual([])
  })
})

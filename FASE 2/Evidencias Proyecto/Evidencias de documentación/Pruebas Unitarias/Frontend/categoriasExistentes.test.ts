// src/features/inventario/utils/categoriasExistentes.test.ts
import { describe, expect, it } from 'vitest'
import {
  categoriaElegida,
  categoriasExistentes,
  opcionesDeCategoria,
} from '@/features/inventario/utils/categoriasExistentes'
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

// en la prueba con usuarios la participante dijo que faltaba poder crear una categoria, y lo puso
// como lo mas molesto. El campo si la aceptaba: lo que no se veia era que se podia
describe('opcionesDeCategoria', () => {
  const categorias = ['Abarrotes', 'Lacteos', 'Snacks']

  it('sin escribir nada ofrece las que ya existen', () => {
    expect(opcionesDeCategoria(categorias, '')).toEqual(categorias)
  })

  it('al escribir algo nuevo ofrece crearlo', () => {
    expect(opcionesDeCategoria(categorias, 'Fiambres')).toEqual(['Crear la categoria "Fiambres"'])
  })

  it('filtra las que calzan y ademas ofrece crear', () => {
    expect(opcionesDeCategoria(categorias, 'Lact')).toEqual(['Lacteos', 'Crear la categoria "Lact"'])
  })

  it('no ofrece crear una que ya existe, aunque este escrita distinto', () => {
    expect(opcionesDeCategoria(categorias, 'lacteos')).toEqual(['Lacteos'])
  })

  it('los espacios de los costados no crean una categoria aparte', () => {
    expect(opcionesDeCategoria(categorias, '  Lacteos  ')).toEqual(['Lacteos'])
  })
})

describe('categoriaElegida', () => {
  it('de la lista devuelve el nombre tal cual', () => {
    expect(categoriaElegida('Lacteos')).toBe('Lacteos')
  })

  it('de la opcion de crear devuelve solo el nombre', () => {
    expect(categoriaElegida('Crear la categoria "Fiambres"')).toBe('Fiambres')
  })
})

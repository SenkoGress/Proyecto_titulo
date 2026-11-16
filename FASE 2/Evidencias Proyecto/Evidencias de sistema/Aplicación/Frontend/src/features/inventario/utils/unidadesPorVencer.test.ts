// src/features/inventario/utils/unidadesPorVencer.test.ts
import { describe, expect, it } from 'vitest'
import { textoUnidadesPorVencer, tieneUnidadesEnRiesgo } from '@/features/inventario/utils/unidadesPorVencer'

describe('textoUnidadesPorVencer', () => {
  it('muestra las unidades cuando se conocen', () => {
    expect(textoUnidadesPorVencer(34)).toBe('34 un.')
  })

  // el backend sabe que no queda stock, no es un dato desconocido
  it('cero es sin stock, no es falta de informacion', () => {
    expect(textoUnidadesPorVencer(0)).toBe('sin stock')
  })

  // compras anteriores a la tabla de lotes: hay fecha pero no se sabe cuanto vence en ella
  it('null no inventa un numero', () => {
    expect(textoUnidadesPorVencer(null)).toBeNull()
    expect(textoUnidadesPorVencer(undefined)).toBeNull()
  })
})

describe('tieneUnidadesEnRiesgo', () => {
  it('solo cuenta si quedan unidades', () => {
    expect(tieneUnidadesEnRiesgo(5)).toBe(true)
    expect(tieneUnidadesEnRiesgo(0)).toBe(false)
    expect(tieneUnidadesEnRiesgo(null)).toBe(false)
  })
})

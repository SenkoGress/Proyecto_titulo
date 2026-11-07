// src/features/mercado/utils/busquedaMercado.test.ts
import { describe, expect, it } from 'vitest'
import { terminoDeBusqueda, urlDeBusqueda } from '@/features/mercado/utils/busquedaMercado'

describe('terminoDeBusqueda', () => {
  it('saca el envase, que no sirve para buscar en el mercado', () => {
    expect(terminoDeBusqueda('Coca Cola 350ml Lata')).toBe('Coca Cola Lata')
  })

  it('saca los formatos de caja del proveedor', () => {
    expect(terminoDeBusqueda('CHANDELLE Crema Manjar 20x120g CL')).toBe('CHANDELLE Crema Manjar CL')
  })

  it('saca los parentesis de la norma, que no se buscan', () => {
    expect(terminoDeBusqueda('Bolsa Reutilizable (Ley N 21.368)')).toBe('Bolsa Reutilizable Ley N 21.368')
  })

  it('deja el nombre intacto cuando no trae medidas', () => {
    expect(terminoDeBusqueda('Yerba Mate Taragui')).toBe('Yerba Mate Taragui')
  })
})

describe('urlDeBusqueda', () => {
  it('arma la busqueda de mercado libre con guiones', () => {
    expect(urlDeBusqueda('mercadolibre', 'Coca Cola 350ml')).toBe(
      'https://listado.mercadolibre.cl/Coca-Cola'
    )
  })

  it('arma la de aliexpress con su terminacion', () => {
    expect(urlDeBusqueda('aliexpress', 'Yerba Mate')).toBe(
      'https://es.aliexpress.com/w/wholesale-Yerba-Mate.html'
    )
  })

  it('no arma nada si el nombre queda vacio al limpiarlo', () => {
    expect(urlDeBusqueda('mercadolibre', '500ml')).toBe('')
  })
})

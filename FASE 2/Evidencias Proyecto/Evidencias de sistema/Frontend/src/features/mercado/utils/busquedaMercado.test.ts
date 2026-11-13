// src/features/mercado/utils/busquedaMercado.test.ts
import { describe, expect, it } from 'vitest'
import {
  VISTAS,
  pideCuenta,
  terminoDeBusqueda,
  urlDeBusqueda,
  urlDeVista,
} from '@/features/mercado/utils/busquedaMercado'

describe('terminoDeBusqueda', () => {
  it('saca el envase, que no sirve para buscar en el mercado', () => {
    expect(terminoDeBusqueda('Coca Cola 350ml Lata')).toBe('Coca Cola Lata')
  })

  it('saca los formatos de caja del proveedor', () => {
    expect(terminoDeBusqueda('CHANDELLE Crema Manjar 20x120g CL')).toBe('CHANDELLE Crema Manjar CL')
  })

  it('saca los parentesis de la norma, que no se buscan', () => {
    expect(terminoDeBusqueda('Bolsa Reutilizable (Ley N 21.100)')).toBe('Bolsa Reutilizable Ley N 21.100')
  })

  it('saca la medida que termina en numero, como la caja de 6x200cm3', () => {
    expect(terminoDeBusqueda('NESTLE La Crema Caja 5(6x200cm3) N1 CL')).toBe(
      'NESTLE La Crema Caja 5 N1 CL'
    )
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

describe('urlDeVista', () => {
  it('apunta a la pagina de tendencias de busqueda', () => {
    expect(urlDeVista('tendencias')).toBe('https://tendencias.mercadolibre.cl/')
  })

  it('apunta a la pagina de mas vendidos', () => {
    expect(urlDeVista('mas_vendidos')).toBe('https://www.mercadolibre.cl/mas-vendidos')
  })

  it('las dos vistas viven en mercado libre, que es donde se ven sin cuenta', () => {
    VISTAS.forEach((vista) => {
      expect(new URL(vista.url).hostname.endsWith('mercadolibre.cl')).toBe(true)
    })
  })
})

describe('pideCuenta', () => {
  // mercado libre manda el listado de un producto a /gz/account-verification sin sesion
  it('avisa que mercado libre pide sesion para el listado de un producto', () => {
    expect(pideCuenta('mercadolibre')).toBe(true)
  })

  it('aliexpress muestra su busqueda sin cuenta', () => {
    expect(pideCuenta('aliexpress')).toBe(false)
  })
})

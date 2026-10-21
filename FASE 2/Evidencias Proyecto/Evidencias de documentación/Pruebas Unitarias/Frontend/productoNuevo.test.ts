// src/features/inventario/utils/productoNuevo.test.ts
import { describe, expect, it } from 'vitest'
import { esProductoNuevo, esProductoRepuesto, ultimoCierreZ } from '@/features/inventario/utils/productoNuevo'
import type { ProductoInventario } from '@/features/inventario/types'
import type { CierreHistorial } from '@/features/caja/types'

function producto(campos: Partial<ProductoInventario>): ProductoInventario {
  return {
    origen_creacion: 'FACTURA',
    factura_origen_folio: 'FAC-11354',
    created_at: null,
    ultimo_ingreso_factura: null,
    ...campos,
  } as ProductoInventario
}

function cierre(fecha_cierre: string | null): CierreHistorial {
  return { fecha_cierre } as CierreHistorial
}

describe('ultimoCierreZ', () => {
  it('se queda con el cierre mas reciente aunque vengan desordenados', () => {
    const historial = [
      cierre('2026-09-22 22:56:40'),
      cierre('2026-09-24 01:38:05'),
      cierre('2026-09-23 10:00:00'),
    ]
    expect(ultimoCierreZ(historial)?.toISOString()).toBe('2026-09-24T01:38:05.000Z')
  })

  it('ignora los turnos todavia abiertos', () => {
    const historial = [cierre('2026-09-22 22:56:40'), cierre(null)]
    expect(ultimoCierreZ(historial)?.toISOString()).toBe('2026-09-22T22:56:40.000Z')
  })

  it('devuelve null cuando no hay ningun cierre', () => {
    expect(ultimoCierreZ([])).toBeNull()
    expect(ultimoCierreZ(undefined)).toBeNull()
  })
})

describe('esProductoNuevo', () => {
  const ultimoZ = new Date('2026-09-24T01:38:05.000Z')

  it('no marca los productos del catalogo base', () => {
    const delCatalogo = producto({ origen_creacion: 'CATALOGO', created_at: '2026-10-08 12:00:00' })
    expect(esProductoNuevo(delCatalogo, ultimoZ)).toBe(false)
  })

  it('marca el que entro despues del ultimo cierre', () => {
    expect(esProductoNuevo(producto({ created_at: '2026-09-25 09:00:00' }), ultimoZ)).toBe(true)
  })

  it('deja de marcar el que ya paso por un cierre', () => {
    expect(esProductoNuevo(producto({ created_at: '2026-09-23 09:00:00' }), ultimoZ)).toBe(false)
  })

  it('marca cuando todavia no hay ningun cierre hecho', () => {
    expect(esProductoNuevo(producto({ created_at: '2026-09-23 09:00:00' }), null)).toBe(true)
  })

  it('no marca si no viene la fecha de creacion', () => {
    expect(esProductoNuevo(producto({ created_at: null }), ultimoZ)).toBe(false)
  })
})

describe('esProductoRepuesto', () => {
  const ultimoZ = new Date('2026-09-24T01:38:05.000Z')

  it('marca el que ya existia y se repuso despues del ultimo cierre', () => {
    const repuesto = producto({
      origen_creacion: 'CATALOGO',
      ultimo_ingreso_factura: '2026-09-25 09:00:00',
    })
    expect(esProductoRepuesto(repuesto, ultimoZ)).toBe(true)
  })

  it('deja de marcar cuando la reposicion ya paso por un cierre', () => {
    const repuesto = producto({
      origen_creacion: 'CATALOGO',
      ultimo_ingreso_factura: '2026-09-23 09:00:00',
    })
    expect(esProductoRepuesto(repuesto, ultimoZ)).toBe(false)
  })

  it('no marca el que nunca se repuso por factura', () => {
    const nunca = producto({ origen_creacion: 'CATALOGO', ultimo_ingreso_factura: null })
    expect(esProductoRepuesto(nunca, ultimoZ)).toBe(false)
  })

  // si es nuevo manda esa etiqueta, no se muestran las dos
  it('no marca como repuesto al que ya sale como nuevo', () => {
    const nuevo = producto({
      created_at: '2026-09-25 09:00:00',
      ultimo_ingreso_factura: '2026-09-25 09:00:00',
    })
    expect(esProductoNuevo(nuevo, ultimoZ)).toBe(true)
    expect(esProductoRepuesto(nuevo, ultimoZ)).toBe(false)
  })
})

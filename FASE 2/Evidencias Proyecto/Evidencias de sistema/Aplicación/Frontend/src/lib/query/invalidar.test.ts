// src/lib/query/invalidar.test.ts
import { describe, expect, it, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { trasIngresarFactura, trasMoverCaja, trasVender } from '@/lib/query/invalidar'

// que claves quedaron marcadas como viejas
function clavesInvalidadas(accion: (cliente: QueryClient) => void): string[] {
  const cliente = new QueryClient()
  const espia = vi.spyOn(cliente, 'invalidateQueries').mockImplementation(() => Promise.resolve())
  accion(cliente)
  return espia.mock.calls.map((llamada) => (llamada[0]?.queryKey as string[]).join('/'))
}

// Antes una venta solo avisaba del catalogo y del estado: el cajero vendia la ultima unidad y el
// inventario se la seguia mostrando, o entraba a Ventas y la venta no estaba. Cada consulta da por
// buena su ultima respuesta durante un minuto, asi que no se arreglaba solo hasta pasado ese rato
describe('trasVender', () => {
  const claves = clavesInvalidadas(trasVender)

  it('refresca el catalogo y el stock del inventario', () => {
    expect(claves).toContain('pos/productos')
    expect(claves).toContain('inventario')
  })

  it('refresca el historial de ventas, que es donde el cajero va a mirar', () => {
    expect(claves).toContain('pos/transacciones')
  })

  it('refresca la caja y el panel', () => {
    expect(claves).toContain('caja/resumen')
    expect(claves).toContain('dashboard')
  })

  it('refresca la reposicion: la venta puede dejar un producto bajo el minimo', () => {
    expect(claves).toContain('replenishment')
  })

  it('refresca la lista de documentos emitidos', () => {
    expect(claves).toContain('dte/lista')
  })

  // el semaforo de vencimientos cuelga de inventario, asi que esa clave lo cubre
  it('no avisa de pantallas que la venta no cambia', () => {
    expect(claves).not.toContain('proveedores')
    expect(claves).not.toContain('auth/usuarios')
    expect(claves).not.toContain('configuracion/correo')
  })
})

describe('trasIngresarFactura', () => {
  const claves = clavesInvalidadas(trasIngresarFactura)

  it('entra stock: refresca catalogo, inventario y reposicion', () => {
    expect(claves).toContain('pos/productos')
    expect(claves).toContain('inventario')
    expect(claves).toContain('replenishment')
  })

  it('la cola de facturas pierde su ticket', () => {
    expect(claves).toContain('invoices')
  })

  // una factura no mueve la gaveta: se paga al proveedor, no en la caja
  it('no toca la caja', () => {
    expect(claves).not.toContain('caja/resumen')
  })
})

describe('trasMoverCaja', () => {
  const claves = clavesInvalidadas(trasMoverCaja)

  it('refresca el turno y el historial de cierres', () => {
    expect(claves).toEqual(['caja/resumen', 'caja/historial'])
  })
})

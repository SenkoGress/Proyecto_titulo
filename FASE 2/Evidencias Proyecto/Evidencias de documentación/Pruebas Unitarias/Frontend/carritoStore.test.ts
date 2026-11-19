// src/features/pos/stores/carritoStore.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCarritoStore } from '@/features/pos/stores/carritoStore'
import type { Producto } from '@/features/pos/types'

function producto(campos: Partial<Producto> = {}): Producto {
  return {
    id: 'p-1',
    nombre: 'Yogur Natural 1L',
    stock_actual: 5,
    precio_venta: 1290,
    fecha_vencimiento: null,
    ...campos,
  } as Producto
}

const carrito = () => useCarritoStore.getState()
const enTicket = () => carrito().lineas.map((linea) => [linea.producto.id, linea.cantidad])

// d.s. 977/96: un producto vencido no entra a la venta sin que el cajero lo decida
describe('carritoStore: producto vencido', () => {
  beforeEach(() => {
    // 19 de noviembre de 2026 a las 22:30: en UTC ya es el dia siguiente
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 10, 19, 22, 30))
    carrito().limpiar()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('un vencido queda por confirmar y no entra al ticket', () => {
    const vencido = producto({ fecha_vencimiento: '2026-11-18' })

    carrito().agregar(vencido)

    expect(carrito().porConfirmarVencido).toEqual(vencido)
    expect(enTicket()).toEqual([])
  })

  it('confirmar lo agrega y descartar lo deja fuera', () => {
    carrito().agregar(producto({ fecha_vencimiento: '2026-11-18' }))
    carrito().confirmarVencido()
    expect(enTicket()).toEqual([['p-1', 1]])
    expect(carrito().porConfirmarVencido).toBeNull()

    carrito().agregar(producto({ id: 'p-2', fecha_vencimiento: '2026-11-01' }))
    carrito().descartarVencido()
    expect(enTicket()).toEqual([['p-1', 1]])
    expect(carrito().porConfirmarVencido).toBeNull()
  })

  it('lo vigente, lo que vence hoy, lo que no tiene fecha y una fecha ilegible entran directo', () => {
    carrito().agregar(producto({ id: 'a', fecha_vencimiento: '2026-12-30' }))
    carrito().agregar(producto({ id: 'b', fecha_vencimiento: '2026-11-19' }))
    carrito().agregar(producto({ id: 'c', fecha_vencimiento: null }))
    carrito().agregar(producto({ id: 'd', fecha_vencimiento: 'pronto' }))

    expect(carrito().porConfirmarVencido).toBeNull()
    expect(enTicket()).toEqual([['a', 1], ['b', 1], ['c', 1], ['d', 1]])
  })

  it('una fecha guardada con hora se lee por su dia', () => {
    carrito().agregar(producto({ fecha_vencimiento: '2026-11-18 00:00:00' }))

    expect(carrito().porConfirmarVencido).not.toBeNull()
  })

  it('sumar unidades de un vencido ya confirmado no vuelve a preguntar', () => {
    const vencido = producto({ fecha_vencimiento: '2026-11-18' })
    carrito().agregar(vencido)
    carrito().confirmarVencido()

    carrito().agregar(vencido)
    carrito().fijarCantidad('p-1', 4)

    expect(carrito().porConfirmarVencido).toBeNull()
    expect(enTicket()).toEqual([['p-1', 4]])
  })

  it('si se quita la linea y se vuelve a agregar, pregunta de nuevo', () => {
    const vencido = producto({ fecha_vencimiento: '2026-11-18' })
    carrito().agregar(vencido)
    carrito().confirmarVencido()
    carrito().eliminarLinea('p-1')

    carrito().agregar(vencido)

    expect(carrito().porConfirmarVencido).toEqual(vencido)
    expect(enTicket()).toEqual([])
  })

  it('un vencido sin stock se rechaza sin preguntar', () => {
    carrito().agregar(producto({ fecha_vencimiento: '2026-11-18', stock_actual: 0 }))

    expect(carrito().porConfirmarVencido).toBeNull()
    expect(enTicket()).toEqual([])
  })

  // si el pendiente sobreviviera al cobro, terminaria en el ticket del cliente siguiente
  it('limpiar la venta borra el pendiente', () => {
    carrito().agregar(producto({ fecha_vencimiento: '2026-11-18' }))

    carrito().limpiar()
    carrito().confirmarVencido()

    expect(carrito().porConfirmarVencido).toBeNull()
    expect(enTicket()).toEqual([])
  })
})

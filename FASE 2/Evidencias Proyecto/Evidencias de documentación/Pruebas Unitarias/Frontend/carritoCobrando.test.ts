// src/features/pos/stores/carritoCobrando.test.ts
import { beforeEach, describe, expect, it } from 'vitest'
import { useCarritoStore } from '@/features/pos/stores/carritoStore'
import type { Producto } from '@/features/pos/types'

const carrito = () => useCarritoStore.getState()
const coca = { id: 'p-1', nombre: 'COCA COLA Zero 350 ml', stock_actual: 30, precio_venta: 990 } as Producto
const pan = { id: 'p-2', nombre: 'IDEAL Pan Blanco 750 g', stock_actual: 12, precio_venta: 2190 } as Producto

// La maquina puede tardar hasta dos minutos y medio. En ese rato se podia escanear al siguiente
// cliente o apretar Escape: al aprobarse la venta, el ticket se vacia y lo agregado se perdia
describe('el ticket queda congelado mientras la maquina responde', () => {
  beforeEach(() => {
    carrito().marcarCobrando(false)
    carrito().limpiar()
    carrito().agregar(coca)
    carrito().marcarCobrando(true)
  })

  it('no entra lo que se escanee del siguiente cliente', () => {
    carrito().agregar(pan)

    expect(carrito().lineas).toHaveLength(1)
  })

  it('no suma otra unidad del mismo producto', () => {
    carrito().agregar(coca)

    expect(carrito().lineas[0].cantidad).toBe(1)
  })

  it('Escape no vacia el ticket a medio cobrar', () => {
    carrito().limpiar()

    expect(carrito().lineas).toHaveLength(1)
  })

  it('no se quita ni se edita una linea', () => {
    carrito().quitarUno(coca.id)
    carrito().fijarCantidad(coca.id, 5)
    carrito().eliminarLinea(coca.id)

    expect(carrito().lineas).toHaveLength(1)
    expect(carrito().lineas[0].cantidad).toBe(1)
  })

  it('al terminar el cobro vuelve a funcionar todo', () => {
    carrito().marcarCobrando(false)

    carrito().agregar(pan)
    expect(carrito().lineas).toHaveLength(2)

    carrito().limpiar()
    expect(carrito().lineas).toHaveLength(0)
  })

  // el ticket nuevo tiene que partir sin la marca puesta
  it('vaciar el ticket deja la marca apagada', () => {
    carrito().marcarCobrando(false)
    carrito().limpiar()

    expect(carrito().cobrando).toBe(false)
  })
})

// src/features/pos/hooks/useCobrarVenta.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import { AxiosError, AxiosHeaders } from 'axios'
import { useCobrarVenta } from '@/features/pos/hooks/useCobrarVenta'
import { useCarritoStore } from '@/features/pos/stores/carritoStore'
import type { Producto } from '@/features/pos/types'

const mutate = vi.fn()
const estado: { error: unknown; isPending: boolean } = { error: null, isPending: false }

vi.mock('@/features/pos/hooks/usePos', () => ({
  useRegistrarVenta: () => ({ mutate, isPending: estado.isPending, error: estado.error }),
}))

vi.mock('@/features/auth/utils/identidad', () => ({
  tenantActual: () => '00000000-0000-0000-0000-000000000001',
  usuarioActualId: () => '00000000-0000-0000-0000-000000000002',
}))

const carrito = () => useCarritoStore.getState()

// galletas de 450: dos quedan en 900, un monto que no necesita redondeo
const galletas = { id: 'p-1', nombre: 'CLUB SOCIAL Original 24 g', stock_actual: 40, precio_venta: 450 } as Producto

function cobroSinVentaError() {
  const error = new AxiosError('Request failed', 'ERR_BAD_RESPONSE')
  error.response = {
    status: 500,
    data: { error: 'COBRO_SIN_VENTA', message: 'La tarjeta quedo cobrada y la venta no se guardo.' },
    statusText: '',
    headers: {},
    config: { headers: new AxiosHeaders() },
  }
  return error
}

// Los dos modos de caja tienen el boton bloqueado en estos casos, pero el atajo F4 llamaba a
// cobrar() directo y entraba igual: cobraba la tarjeta dos veces, o cerraba una venta en efectivo
// sin saber con cuanto pago el cliente. El candado tiene que estar en la accion, no solo en el boton
describe('useCobrarVenta: lo que el atajo no puede saltarse', () => {
  beforeEach(() => {
    mutate.mockClear()
    estado.error = null
    estado.isPending = false
    // el mutate esta simulado, asi que onSettled no corre y la marca de cobrando quedaria puesta
    carrito().marcarCobrando(false)
    carrito().limpiar()
  })
  afterEach(cleanup)

  it('con la tarjeta ya cobrada y la venta perdida, no vuelve a cobrar', () => {
    estado.error = cobroSinVentaError()
    const { result } = renderHook(() => useCobrarVenta())
    act(() => {
      carrito().agregar(galletas)
      carrito().cambiarMetodoPago('TRANSBANK')
    })

    act(() => result.current.cobrar())

    expect(mutate).not.toHaveBeenCalled()
  })

  it('en efectivo sin el monto recibido, no cobra', () => {
    const { result } = renderHook(() => useCobrarVenta())
    act(() => carrito().agregar(galletas))

    act(() => result.current.cobrar())

    expect(mutate).not.toHaveBeenCalled()
  })

  it('en efectivo con menos de lo que vale, tampoco', () => {
    const { result } = renderHook(() => useCobrarVenta())
    act(() => {
      carrito().agregar(galletas)
      carrito().fijarMontoRecibido(400)
    })

    act(() => result.current.cobrar())

    expect(mutate).not.toHaveBeenCalled()
  })

  it('en efectivo con el monto anotado, cobra', () => {
    const { result } = renderHook(() => useCobrarVenta())
    act(() => {
      carrito().agregar(galletas)
      carrito().fijarMontoRecibido(1000)
    })

    act(() => result.current.cobrar())

    expect(mutate).toHaveBeenCalledTimes(1)
  })

  // con tarjeta no hay monto que anotar: el candado del efectivo no debe estorbar
  it('con tarjeta cobra sin anotar nada', () => {
    const { result } = renderHook(() => useCobrarVenta())
    act(() => {
      carrito().agregar(galletas)
      carrito().cambiarMetodoPago('TRANSBANK')
    })

    act(() => result.current.cobrar())

    expect(mutate).toHaveBeenCalledTimes(1)
  })

  it('con el carrito vacio no cobra', () => {
    const { result } = renderHook(() => useCobrarVenta())

    act(() => result.current.cobrar())

    expect(mutate).not.toHaveBeenCalled()
  })

  it('mientras se espera la maquina no cobra de nuevo', () => {
    estado.isPending = true
    const { result } = renderHook(() => useCobrarVenta())
    act(() => {
      carrito().agregar(galletas)
      carrito().cambiarMetodoPago('TRANSBANK')
    })

    act(() => result.current.cobrar())

    expect(mutate).not.toHaveBeenCalled()
  })
})

// src/features/pos/hooks/useAtajosTeclado.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAtajosTeclado, type AccionesAtajos } from '@/features/pos/hooks/useAtajosTeclado'
import { useCarritoStore } from '@/features/pos/stores/carritoStore'
import type { Producto } from '@/features/pos/types'

function acciones(): AccionesAtajos {
  return {
    ayuda: vi.fn(),
    buscar: vi.fn(),
    editarCantidad: vi.fn(),
    cobrar: vi.fn(),
    limpiar: vi.fn(),
    elegirMetodo: vi.fn(),
  }
}

const presionar = (key: string) => window.dispatchEvent(new KeyboardEvent('keydown', { key }))

describe('useAtajosTeclado', () => {
  beforeEach(() => {
    useCarritoStore.getState().limpiar()
  })

  it('F4 cobra y Escape limpia la venta', () => {
    const a = acciones()
    renderHook(() => useAtajosTeclado(a))

    presionar('F4')
    presionar('Escape')

    expect(a.cobrar).toHaveBeenCalledTimes(1)
    expect(a.limpiar).toHaveBeenCalledTimes(1)
  })

  // con el aviso de producto vencido abierto, la caja espera la decision del cajero
  it('con un producto vencido por confirmar, ningun atajo actua', () => {
    const a = acciones()
    renderHook(() => useAtajosTeclado(a))
    useCarritoStore.setState({ porConfirmarVencido: { id: 'p-1', nombre: 'Yogur' } as Producto })

    presionar('F4')
    presionar('Escape')
    presionar('2')

    expect(a.cobrar).not.toHaveBeenCalled()
    expect(a.limpiar).not.toHaveBeenCalled()
    expect(a.elegirMetodo).not.toHaveBeenCalled()
  })
})

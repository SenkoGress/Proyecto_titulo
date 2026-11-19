// src/features/pos/components/compartidos/DialogoProductoVencido.test.tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DialogoProductoVencido } from '@/features/pos/components/compartidos/DialogoProductoVencido'
import { CajaVisual } from '@/features/pos/components/visual/CajaVisual'
import { CajaTecnica } from '@/features/pos/components/tecnico/CajaTecnica'
import { useCarritoStore } from '@/features/pos/stores/carritoStore'
import type { Producto } from '@/features/pos/types'

const carrito = () => useCarritoStore.getState()

function vencido(fecha: string): Producto {
  return { id: 'p-1', nombre: 'Yogur Natural 1L', stock_actual: 5, precio_venta: 1290, fecha_vencimiento: fecha } as Producto
}

function conConsultas(nodo: React.ReactNode) {
  return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{nodo}</QueryClientProvider>
}

describe('DialogoProductoVencido', () => {
  beforeEach(() => {
    // 19 de noviembre de 2026; solo se fija la fecha, los temporizadores siguen siendo los reales
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 19, 22, 30))
    carrito().limpiar()
    // el cajero esta en el campo del lector cuando aparece el aviso
    const lector = document.createElement('input')
    document.body.appendChild(lector)
    lector.focus()
  })

  afterEach(() => {
    cleanup()
    document.body.innerHTML = ''
    vi.useRealTimers()
  })

  it('no aparece si no hay un producto por confirmar', () => {
    render(<DialogoProductoVencido />)

    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('nombra el producto, su fecha y los dias que lleva vencido, y cita el decreto', () => {
    carrito().agregar(vencido('2026-11-16 00:00:00'))
    render(<DialogoProductoVencido />)

    const texto = screen.getByRole('dialog').textContent ?? ''
    expect(texto).toContain('Yogur Natural 1L')
    expect(texto).toContain('16-11-2026')
    expect(texto).toContain('hace 3 dias')
    expect(texto).toContain('D.S. N° 977/96')
  })

  it('un dia de vencido se dice en singular', () => {
    carrito().agregar(vencido('2026-11-18'))
    render(<DialogoProductoVencido />)

    expect(screen.getByRole('dialog').textContent).toContain('hace 1 dia.')
  })

  it('«No vender» lo deja fuera y «Vender de todos modos» lo agrega', () => {
    carrito().agregar(vencido('2026-11-16'))
    render(<DialogoProductoVencido />)

    fireEvent.click(screen.getByRole('button', { name: 'No vender' }))
    expect(carrito().porConfirmarVencido).toBeNull()
    expect(carrito().lineas).toHaveLength(0)

    act(() => carrito().agregar(vencido('2026-11-16')))
    fireEvent.click(screen.getByRole('button', { name: 'Vender de todos modos' }))
    expect(carrito().lineas.map((linea) => linea.producto.id)).toEqual(['p-1'])
  })

  // el lector de codigos manda Enter despues de cada lectura: no puede responder por el cajero
  it('ningun boton tiene el foco, y Enter no decide nada', () => {
    carrito().agregar(vencido('2026-11-16'))
    render(<DialogoProductoVencido />)

    expect(document.activeElement?.tagName).not.toBe('BUTTON')
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Enter' })

    expect(carrito().porConfirmarVencido).not.toBeNull()
    expect(carrito().lineas).toHaveLength(0)
  })

  // en una caja tactil, un doble toque sobre el producto caeria en el fondo del aviso
  it('un toque fuera del aviso no lo cierra, y Escape si', () => {
    carrito().agregar(vencido('2026-11-16'))
    render(<DialogoProductoVencido />)

    fireEvent.click(document.querySelector('.MuiBackdrop-root') as Element)
    expect(carrito().porConfirmarVencido).not.toBeNull()

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(carrito().porConfirmarVencido).toBeNull()
  })

  // sin el aviso montado, un producto vencido queda imposible de agregar y nadie se entera
  it.each([
    ['visual', CajaVisual],
    ['tecnica', CajaTecnica],
  ])('la caja %s muestra el aviso', (_modo, Caja) => {
    render(conConsultas(<Caja />))
    expect(screen.queryByText('Producto vencido')).toBeNull()

    act(() => carrito().agregar(vencido('2026-11-16')))

    expect(screen.getByText('Producto vencido')).toBeTruthy()
  })
})

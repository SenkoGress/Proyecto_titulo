// src/features/pos/components/visual/TicketVisual.test.tsx
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CajaVisual } from '@/features/pos/components/visual/CajaVisual'
import { TicketVisual } from '@/features/pos/components/visual/TicketVisual'
import { useCarritoStore } from '@/features/pos/stores/carritoStore'
import type { Producto } from '@/features/pos/types'

const carrito = () => useCarritoStore.getState()

const coca = {
  id: 'p-1',
  nombre: 'COCA COLA Zero Azucar 350 ml',
  stock_actual: 31,
  precio_venta: 990,
} as Producto

const galletas = {
  id: 'p-2',
  nombre: 'CLUB SOCIAL Original 24 g',
  stock_actual: 33,
  precio_venta: 450,
} as Producto

function conConsultas(nodo: React.ReactNode) {
  return (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      {nodo}
    </QueryClientProvider>
  )
}

// el ticket se mudo del panel de la derecha al espacio grande, como en el modo tecnico: ahi caben
// las lineas con su foto y se leen de lejos. En la columna de 400 px quedaban 152 para las lineas
// y con dos productos ya habia que desplazar
describe('CajaVisual: el catalogo cede el espacio al ticket', () => {
  beforeEach(() => carrito().limpiar())
  afterEach(cleanup)

  it('sin venta empezada no ofrece alternar: solo esta el catalogo', () => {
    render(conConsultas(<CajaVisual />))

    expect(screen.queryByRole('button', { name: /Ver el catalogo/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /Ver la venta/i })).toBeNull()
  })

  it('con un producto aparece el ticket en el espacio grande y el boton para volver', () => {
    render(conConsultas(<CajaVisual />))
    act(() => carrito().agregar(coca))

    expect(screen.getByText('COCA COLA Zero Azucar 350 ml')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Ver el catalogo/i })).toBeTruthy()
  })

  it('el boton lleva al catalogo y vuelve al ticket sin perder la venta', () => {
    render(conConsultas(<CajaVisual />))
    act(() => carrito().agregar(coca))

    fireEvent.click(screen.getByRole('button', { name: /Ver el catalogo/i }))
    expect(screen.queryByText('COCA COLA Zero Azucar 350 ml')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /Ver la venta/i }))
    expect(screen.getByText('COCA COLA Zero Azucar 350 ml')).toBeTruthy()
    expect(carrito().lineas).toHaveLength(1)
  })

  it('al vaciar la venta el catalogo vuelve solo', () => {
    render(conConsultas(<CajaVisual />))
    act(() => carrito().agregar(coca))
    expect(screen.getByRole('button', { name: /Ver el catalogo/i })).toBeTruthy()

    act(() => carrito().limpiar())

    expect(screen.queryByRole('button', { name: /Ver el catalogo/i })).toBeNull()
    expect(screen.queryByText('COCA COLA Zero Azucar 350 ml')).toBeNull()
  })
})

describe('TicketVisual', () => {
  beforeEach(() => carrito().limpiar())
  afterEach(cleanup)

  it('sin productos invita a agregarlos', () => {
    render(conConsultas(<TicketVisual />))

    expect(screen.getByText(/Agrega productos desde el catalogo/)).toBeTruthy()
  })

  it('muestra el precio unitario y el subtotal de cada linea', () => {
    render(conConsultas(<TicketVisual />))
    act(() => {
      carrito().agregar(coca)
      carrito().agregar(coca)
      carrito().agregar(galletas)
    })

    expect(screen.getByText('$990 c/u')).toBeTruthy()
    // dos cocas: el subtotal es lo que se lee de lejos
    expect(screen.getByText('$1.980')).toBeTruthy()
    expect(screen.getByText('$450')).toBeTruthy()
  })

  it('cuenta los productos y las unidades al pie', () => {
    render(conConsultas(<TicketVisual />))
    act(() => {
      carrito().agregar(coca)
      carrito().agregar(coca)
      carrito().agregar(galletas)
    })

    expect(screen.getByText('2 producto(s) · 3 unidad(es)')).toBeTruthy()
  })

  it('los botones de cantidad dicen de que producto son, para quien no ve la foto', () => {
    render(conConsultas(<TicketVisual />))
    act(() => carrito().agregar(coca))

    expect(screen.getByRole('button', { name: 'Agregar otro COCA COLA Zero Azucar 350 ml' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Quitar uno de COCA COLA Zero Azucar 350 ml' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Quitar COCA COLA Zero Azucar 350 ml de la venta' })).toBeTruthy()
  })

  it('el boton de agregar se apaga al llegar al stock', () => {
    render(conConsultas(<TicketVisual />))
    act(() => {
      carrito().agregar(coca)
      carrito().fijarCantidad(coca.id, 31)
    })

    const agregar = screen.getByRole('button', { name: /Agregar otro COCA COLA/ }) as HTMLButtonElement
    expect(agregar.disabled).toBe(true)
  })

  it('quitar la linea la saca de la venta', () => {
    render(conConsultas(<TicketVisual />))
    act(() => carrito().agregar(coca))

    fireEvent.click(screen.getByRole('button', { name: /Quitar COCA COLA .* de la venta/ }))

    expect(carrito().lineas).toHaveLength(0)
  })
})

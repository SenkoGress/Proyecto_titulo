// src/features/pos/components/compartidos/cobroEnEfectivo.test.tsx
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CajaVisual } from '@/features/pos/components/visual/CajaVisual'
import { CajaTecnica } from '@/features/pos/components/tecnico/CajaTecnica'
import { useCarritoStore } from '@/features/pos/stores/carritoStore'
import type { Producto } from '@/features/pos/types'

const carrito = () => useCarritoStore.getState()

// galletas de 450: dos quedan en 900, un monto que no necesita redondeo
const galletas = {
  id: 'p-1',
  nombre: 'CLUB SOCIAL Original 24 g',
  stock_actual: 40,
  precio_venta: 450,
} as Producto

function conConsultas(nodo: React.ReactNode) {
  return (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      {nodo}
    </QueryClientProvider>
  )
}

// el boton de cobrar es el unico que lleva el monto en su texto
function botonDeCobrar(): HTMLButtonElement {
  const boton = screen
    .getAllByRole('button')
    .find((candidato) => /cobrar|anota con cuanto paga/i.test(candidato.textContent ?? ''))
  if (!boton) throw new Error('no encuentro el boton de cobrar')
  return boton as HTMLButtonElement
}

// en la prueba con usuarios la participante cobro en efectivo sin anotar con cuanto pagaba el
// cliente, y el sistema la dejo. El monto vivia dentro de la calculadora de vuelto y el boton de
// cobrar no lo veia, asi que la venta se cerraba sin saber que entro a la gaveta
describe.each([
  ['visual', CajaVisual],
  ['tecnica', CajaTecnica],
])('la caja %s no cobra en efectivo sin el monto recibido', (_modo, Caja) => {
  beforeEach(() => carrito().limpiar())
  afterEach(cleanup)

  it('con productos pero sin monto, el boton no deja cobrar y dice por que', () => {
    render(conConsultas(<Caja />))
    act(() => carrito().agregar(galletas))

    const boton = botonDeCobrar()
    expect(boton.disabled).toBe(true)
    expect(boton.textContent?.toLowerCase()).toContain('anota con cuanto paga')
  })

  it('con menos de lo que vale, sigue sin dejar cobrar', () => {
    render(conConsultas(<Caja />))
    act(() => {
      carrito().agregar(galletas)
      carrito().fijarMontoRecibido(400)
    })

    expect(botonDeCobrar().disabled).toBe(true)
  })

  it('anotado el monto, deja cobrar', () => {
    render(conConsultas(<Caja />))
    act(() => {
      carrito().agregar(galletas)
      carrito().fijarMontoRecibido(1000)
    })

    const boton = botonDeCobrar()
    expect(boton.disabled).toBe(false)
    expect(boton.textContent?.toLowerCase()).toContain('cobrar')
  })

  it('si se agrega otro producto y el total sube, vuelve a pedir lo que falta', () => {
    render(conConsultas(<Caja />))
    act(() => {
      carrito().agregar(galletas)
      carrito().fijarMontoRecibido(450)
    })
    expect(botonDeCobrar().disabled).toBe(false)

    act(() => carrito().agregar(galletas))

    expect(botonDeCobrar().disabled).toBe(true)
  })

  it('con tarjeta no se anota nada y cobra igual', () => {
    render(conConsultas(<Caja />))
    act(() => {
      carrito().agregar(galletas)
      carrito().cambiarMetodoPago('TRANSBANK')
    })

    expect(botonDeCobrar().disabled).toBe(false)
  })

  it('la venta siguiente parte sin el monto del cliente anterior', () => {
    render(conConsultas(<Caja />))
    act(() => {
      carrito().agregar(galletas)
      carrito().fijarMontoRecibido(1000)
    })

    act(() => carrito().limpiar())
    expect(carrito().montoRecibido).toBe(0)

    act(() => carrito().agregar(galletas))
    expect(botonDeCobrar().disabled).toBe(true)
  })
})

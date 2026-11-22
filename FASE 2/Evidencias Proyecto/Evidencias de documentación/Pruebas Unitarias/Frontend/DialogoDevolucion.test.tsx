// src/features/ventas/components/compartidos/DialogoDevolucion.test.tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { AxiosError, AxiosHeaders } from 'axios'
import { DialogoDevolucion } from '@/features/ventas/components/compartidos/DialogoDevolucion'
import type { FilaVenta } from '@/features/ventas/utils/filaVenta'

const mutate = vi.fn()
const estado: { error: unknown } = { error: null }

vi.mock('@/features/ventas/hooks/useVentas', () => ({
  useDevolucion: () => ({
    mutate,
    isPending: false,
    isError: Boolean(estado.error),
    isSuccess: false,
    error: estado.error,
    data: undefined,
  }),
}))

function rechazo(codigo: string, mensaje: string) {
  const error = new AxiosError('Request failed', 'ERR_BAD_REQUEST')
  error.response = {
    status: 409,
    data: { error: codigo, message: mensaje },
    statusText: '',
    headers: {},
    config: { headers: new AxiosHeaders() },
  }
  return error
}

function venta(medioPagoTipo: string): FilaVenta {
  return {
    id: 'v-1',
    folio: '000012',
    fecha: '2026-11-22 10:00:00',
    total: 2380,
    cajero_nombre: 'Cajera',
    medio_pago_nombre: medioPagoTipo === 'EFECTIVO' ? 'Efectivo' : 'Transbank',
    medio_pago_tipo: medioPagoTipo,
    items: [
      { id: 'i-1', producto_id: 'p-1', producto_nombre: 'Coca Cola Zero 350 ml', sku: 'P-1', cantidad: 2, precio_unitario: 990 },
      { id: 'i-2', producto_id: 'p-2', producto_nombre: 'Club Social 24 g', sku: 'P-2', cantidad: 1, precio_unitario: 400 },
    ],
  } as unknown as FilaVenta
}

// el titulo del dialogo tambien dice "Devolver la venta": hay que pedir el boton
const botonDevolver = () => screen.getByRole('button', { name: /^Devolver \$/ })

const opciones = () =>
  screen
    .getAllByRole('button')
    .map((boton) => boton.textContent ?? '')
    .filter((texto) => /En la maquina|En efectivo|Por transferencia/.test(texto))

describe('DialogoDevolucion: como se devuelve la plata', () => {
  beforeEach(() => {
    mutate.mockClear()
    estado.error = null
    // al cerrarse, el dialogo de MUI devuelve el foco a donde estaba: en jsdom tiene que haber
    // un elemento que lo acepte, si no el desmontaje revienta
    const antes = document.createElement('input')
    document.body.appendChild(antes)
    antes.focus()
  })

  afterEach(() => {
    cleanup()
    document.body.innerHTML = ''
  })

  it('una venta en efectivo solo se puede devolver en efectivo', () => {
    render(<DialogoDevolucion venta={venta('EFECTIVO')} onCerrar={vi.fn()} />)

    expect(opciones()).toEqual(['En efectivo'])
  })

  it('una venta con tarjeta ofrece las tres y parte en la maquina', () => {
    render(<DialogoDevolucion venta={venta('TRANSBANK')} onCerrar={vi.fn()} />)

    expect(opciones()).toEqual(['En la maquina', 'En efectivo', 'Por transferencia'])

    fireEvent.click(botonDevolver())
    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ medioDevolucion: 'TARJETA' }), expect.anything())
  })

  it('el cajero puede elegir efectivo y eso es lo que se manda', () => {
    render(<DialogoDevolucion venta={venta('TRANSBANK')} onCerrar={vi.fn()} />)

    fireEvent.click(screen.getByText('En efectivo'))
    fireEvent.click(botonDevolver())

    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ medioDevolucion: 'EFECTIVO' }), expect.anything())
  })

  // el servidor responde 409 REVERSO_MANUAL y no registra nada: desde ahi la maquina no sirve y
  // hay que decir por donde salio la plata
  it('si la maquina no pudo anular, deja de ofrecerla y explica que no se registro nada', () => {
    estado.error = rechazo('REVERSO_MANUAL', 'El debito en Transbank no se puede anular desde la caja.')
    render(<DialogoDevolucion venta={venta('TRANSBANK')} onCerrar={vi.fn()} />)

    expect(opciones()).toEqual(['En efectivo', 'Por transferencia'])
    expect(screen.getByText(/La maquina no pudo anular el pago/)).toBeTruthy()
    expect(screen.getByText(/no se registro nada todavia/i)).toBeTruthy()
    expect(screen.getByText(/El debito en Transbank no se puede anular/)).toBeTruthy()
  })

  it('tras el reverso fallado, lo que se reenvia ya no es la maquina', () => {
    estado.error = rechazo('REVERSO_MANUAL', 'No se pudo anular.')
    render(<DialogoDevolucion venta={venta('TRANSBANK')} onCerrar={vi.fn()} />)

    fireEvent.click(botonDevolver())

    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ medioDevolucion: 'EFECTIVO' }), expect.anything())
  })

  // debito y caja cerrada: la maquina no anula (409) y el reenvio en efectivo choca con la caja
  // cerrada (400). El dialogo no puede volver a ofrecer la maquina por el solo hecho de que el
  // ultimo error ya no es el del reverso
  it('si despues del reverso fallado llega otro error, la maquina sigue fuera', () => {
    const errores = [
      rechazo('REVERSO_MANUAL', 'El debito en Transbank no se puede anular desde la caja.'),
      rechazo('TURNO_CERRADO', 'La caja esta cerrada. Abre la caja antes de devolver dinero en efectivo.'),
    ]
    mutate.mockImplementation((_variables, opciones?: { onError?: (error: unknown) => void }) => {
      const error = errores.shift() ?? null
      estado.error = error
      if (error) act(() => opciones?.onError?.(error))
    })
    const props = { venta: venta('TRANSBANK'), onCerrar: vi.fn() }
    const { rerender } = render(<DialogoDevolucion {...props} />)

    fireEvent.click(botonDevolver())
    rerender(<DialogoDevolucion {...props} />)
    fireEvent.click(botonDevolver())
    rerender(<DialogoDevolucion {...props} />)

    expect(opciones()).toEqual(['En efectivo', 'Por transferencia'])
    expect(screen.getByText(/La caja esta cerrada/)).toBeTruthy()
    fireEvent.click(botonDevolver())
    expect(mutate).toHaveBeenLastCalledWith(expect.objectContaining({ medioDevolucion: 'EFECTIVO' }), expect.anything())
    mutate.mockReset()
  })

  it('una devolucion ya en curso se avisa sin alarmar', () => {
    estado.error = rechazo('DEVOLUCION_EN_CURSO', 'Esta venta ya tiene una devolucion en curso.')
    render(<DialogoDevolucion venta={venta('TRANSBANK')} onCerrar={vi.fn()} />)

    expect(screen.getByText(/Esta venta ya se esta devolviendo/)).toBeTruthy()
    expect(screen.queryByText(/La maquina no pudo anular/)).toBeNull()
  })
})

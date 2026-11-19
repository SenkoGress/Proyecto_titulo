// src/features/invoices/pages/IngresoFacturasPage.test.tsx
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { IngresoFacturasPage } from '@/features/invoices/pages/IngresoFacturasPage'
import type { ItemFactura, PrevisualizacionFactura } from '@/features/invoices/types'

const mutate = vi.fn()
let vista: PrevisualizacionFactura

vi.mock('@/features/invoices/hooks/useInvoices', () => ({
  useFacturas: () => ({ data: [] }),
  useConfirmarFactura: () => ({ mutate, reset: vi.fn(), isPending: false, error: null, data: undefined }),
}))
vi.mock('@/shared/stores/modoVistaStore', () => ({ useEsModoTecnico: () => false }))
vi.mock('@/shared/components/ui/Migas', () => ({ Migas: () => null }))
vi.mock('@/features/invoices/components/compartidos/SubirFactura', () => ({ SubirFactura: () => null }))
// la cola se reduce a su boton: lo que se prueba aqui es lo que la pagina hace con la factura
vi.mock('@/features/invoices/components/compartidos/PanelColaFacturas', () => ({
  PanelColaFacturas: ({ onRevisar }: { onRevisar: (v: PrevisualizacionFactura, id: string) => void }) => (
    <button onClick={() => onRevisar(vista, 'ticket-1')}>abrir de la cola</button>
  ),
}))

function facturaLeida(fecha: string | null): PrevisualizacionFactura {
  const item: ItemFactura = {
    sku: 'LAC-LECH-1L',
    codigo_barra: '7801234567890',
    descripcion: 'Leche Entera Colun 1L',
    cantidad: 6,
    precio_unitario: 950,
    subtotal: 5700,
    precio_venta_sugerido: 1290,
    es_nuevo: false,
    stock_actual: 34,
    stock_proyectado: 40,
    fecha_vencimiento: fecha,
  }
  return {
    folio_factura: 'F-100',
    rut_proveedor: '76.123.456-0',
    razon_social: 'Proveedor Conocido',
    es_proveedor_nuevo: false,
    items: [item],
    total_factura: 6783,
    raw_data: { folio_factura: 'F-100', rut_proveedor: '76.123.456-0', items: [item] },
  } as unknown as PrevisualizacionFactura
}

async function abrirYAprobar(fecha: string | null) {
  vista = facturaLeida(fecha)
  render(
    <QueryClientProvider client={new QueryClient()}>
      <IngresoFacturasPage />
    </QueryClientProvider>,
  )
  await userEvent.click(screen.getByText('abrir de la cola'))
  await userEvent.click(screen.getByRole('button', { name: /aprobar/i }))
}

describe('IngresoFacturasPage: vencimientos (D.S. 977/96)', () => {
  beforeEach(() => {
    mutate.mockClear()
    // jsdom no trae scrollIntoView
    Element.prototype.scrollIntoView = vi.fn()
  })

  it('no ingresa mientras falte declarar un vencimiento, y con «No vence» lo manda junto al ticket', async () => {
    await abrirYAprobar(null)

    expect(mutate).not.toHaveBeenCalled()
    expect(screen.getByText(/Falta 1 producto por declarar/)).toBeTruthy()

    await userEvent.click(screen.getByRole('checkbox'))
    await userEvent.click(screen.getByRole('button', { name: /aprobar/i }))

    expect(mutate).toHaveBeenCalledTimes(1)
    const enviado = mutate.mock.calls[0][0]
    expect(enviado.colaId).toBe('ticket-1')
    expect(enviado.datos.items[0]).toMatchObject({ no_vence: true, fecha_vencimiento: null })
  })

  it('una fecha que el servidor rechazaria cuenta como faltante', async () => {
    await abrirYAprobar('15/12/2026')

    expect(mutate).not.toHaveBeenCalled()
    expect(screen.getByText(/Falta 1 producto por declarar/)).toBeTruthy()
  })

  it('un producto vencido se avisa antes de ingresar y se puede ingresar de todos modos', async () => {
    await abrirYAprobar('2020-01-01')

    expect(mutate).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog').textContent).toMatch(/Leche Entera Colun 1L/)

    await userEvent.click(screen.getByRole('button', { name: /ingresar de todos modos/i }))

    expect(mutate).toHaveBeenCalledTimes(1)
    expect(mutate.mock.calls[0][0].datos.items[0]).toMatchObject({ no_vence: false, fecha_vencimiento: '2020-01-01' })
  })
})

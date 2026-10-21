// src/features/invoices/components/visual/FilaItemFactura.test.tsx
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FilaItemFactura } from '@/features/invoices/components/visual/FilaItemFactura'
import type { ItemFactura } from '@/features/invoices/types'

function item(campos: Partial<ItemFactura> = {}): ItemFactura {
  return {
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
    fecha_vencimiento: null,
    ...campos,
  }
}

// una fila vive dentro de una tabla
function montar(props: Partial<Parameters<typeof FilaItemFactura>[0]> = {}) {
  const onCambiar = vi.fn()
  const onEliminar = vi.fn()
  render(
    <table>
      <tbody>
        <FilaItemFactura item={item()} onCambiar={onCambiar} onEliminar={onEliminar} {...props} />
      </tbody>
    </table>,
  )
  return { onCambiar, onEliminar }
}

describe('FilaItemFactura', () => {
  it('muestra lo que leyo el motor, listo para revisar', () => {
    montar()
    expect(screen.getByDisplayValue('Leche Entera Colun 1L')).toBeInTheDocument()
    expect(screen.getByDisplayValue('LAC-LECH-1L')).toBeInTheDocument()
    expect(screen.getByText('$5.700')).toBeInTheDocument()
  })

  it('avisa como queda el stock de un producto que ya existe', () => {
    montar()
    expect(screen.getByText('Stock 34 → 40')).toBeInTheDocument()
  })

  it('marca como nuevo el producto que no esta en el catalogo', () => {
    const onCambiar = vi.fn()
    render(
      <table>
        <tbody>
          <FilaItemFactura item={item({ es_nuevo: true })} onCambiar={onCambiar} onEliminar={vi.fn()} />
        </tbody>
      </table>,
    )
    expect(screen.getByText('Nuevo')).toBeInTheDocument()
  })

  // la cantidad se corrige antes de confirmar, cuando el motor leyo mal.
  // la fila es controlada: el valor que se ve lo manda el padre, como en la pantalla real
  it('avisa del cambio de cantidad para que se recalcule', async () => {
    const usuario = userEvent.setup()
    const cambios: Partial<ItemFactura>[] = []

    function Padre() {
      const [fila, setFila] = useState(item())
      return (
        <table>
          <tbody>
            <FilaItemFactura
              item={fila}
              onCambiar={(c) => {
                cambios.push(c)
                setFila((actual) => ({ ...actual, ...c }))
              }}
              onEliminar={vi.fn()}
            />
          </tbody>
        </table>
      )
    }

    render(<Padre />)

    const campo = screen.getByDisplayValue('6')
    await usuario.clear(campo)
    await usuario.type(campo, '3')

    expect(cambios.at(-1)).toEqual({ cantidad: 3 })
    expect(screen.getByDisplayValue('3')).toBeInTheDocument()
  })

  // la factura chilena casi nunca trae la fecha, la escribe el usuario
  it('entrega la fecha de vencimiento que se escribe', async () => {
    const { onCambiar } = montar()

    const campo = document.querySelector('input[type=date]') as HTMLInputElement
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    setter?.call(campo, '2026-12-15')
    campo.dispatchEvent(new Event('input', { bubbles: true }))

    expect(onCambiar).toHaveBeenLastCalledWith({ fecha_vencimiento: '2026-12-15' })
  })

  // borrar la fecha tiene que mandar null, no un texto vacio que el backend no entiende
  it('manda null cuando la fecha se borra', async () => {
    const { onCambiar } = montar({ item: item({ fecha_vencimiento: '2026-12-15' }) })

    const campo = document.querySelector('input[type=date]') as HTMLInputElement
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    setter?.call(campo, '')
    campo.dispatchEvent(new Event('input', { bubbles: true }))

    expect(onCambiar).toHaveBeenLastCalledWith({ fecha_vencimiento: null })
  })

  it('permite sacar una linea que el motor invento', async () => {
    const usuario = userEvent.setup()
    const { onEliminar } = montar()

    await usuario.click(screen.getByRole('button'))

    expect(onEliminar).toHaveBeenCalledOnce()
  })
})

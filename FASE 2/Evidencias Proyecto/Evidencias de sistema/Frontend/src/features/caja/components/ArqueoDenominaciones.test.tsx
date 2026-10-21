// src/features/caja/components/ArqueoDenominaciones.test.tsx
import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ArqueoDenominaciones } from '@/features/caja/components/ArqueoDenominaciones'
import { useArqueoStore } from '@/features/caja/stores/arqueoStore'

// el campo de cada denominacion: la tarjeta que tiene ese monto como titulo
function campoDe(monto: string): HTMLElement {
  const tarjeta = screen.getByText(monto).closest('.MuiPaper-root') as HTMLElement
  return within(tarjeta).getByRole('textbox')
}

function totalContado(): string {
  return screen.getByText(/EFECTIVO FISICO CONTADO/i).closest('div')?.parentElement
    ?.textContent as string
}

describe('ArqueoDenominaciones', () => {
  beforeEach(() => useArqueoStore.getState().limpiar())

  it('parte en cero, sin nada contado', () => {
    render(<ArqueoDenominaciones />)
    expect(totalContado()).toContain('$0')
    expect(screen.getByText('0 piezas fisicas')).toBeInTheDocument()
  })

  it('suma el efectivo segun las piezas de cada denominacion', async () => {
    const usuario = userEvent.setup()
    render(<ArqueoDenominaciones />)

    await usuario.type(campoDe('$20.000'), '2')
    await usuario.type(campoDe('$1.000'), '3')
    await usuario.type(campoDe('$100'), '5')

    // 40.000 + 3.000 + 500
    expect(totalContado()).toContain('$43.500')
    expect(screen.getByText('10 piezas fisicas')).toBeInTheDocument()
  })

  // la gaveta se cuenta con los dedos, no se escriben letras
  it('ignora lo que no sea un numero', async () => {
    const usuario = userEvent.setup()
    render(<ArqueoDenominaciones />)

    await usuario.type(campoDe('$5.000'), 'a2b')

    expect(totalContado()).toContain('$10.000')
  })

  it('limpiar deja el conteo en cero para volver a contar', async () => {
    const usuario = userEvent.setup()
    render(<ArqueoDenominaciones />)

    await usuario.type(campoDe('$10.000'), '4')
    expect(totalContado()).toContain('$40.000')

    await usuario.click(screen.getByRole('button', { name: /limpiar/i }))

    expect(totalContado()).toContain('$0')
    expect(screen.getByText('0 piezas fisicas')).toBeInTheDocument()
  })

  // arqueo ciego: mientras se cuenta, el monto que el sistema espera no se muestra
  it('no revela la cuadratura por contar', async () => {
    const usuario = userEvent.setup()
    render(<ArqueoDenominaciones />)

    await usuario.type(campoDe('$20.000'), '1')

    expect(useArqueoStore.getState().cuadraturaRevelada).toBe(false)
  })
})

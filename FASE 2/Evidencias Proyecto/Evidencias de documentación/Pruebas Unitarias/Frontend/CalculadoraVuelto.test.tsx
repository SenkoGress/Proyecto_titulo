// src/features/pos/components/visual/CalculadoraVuelto.test.tsx
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { CalculadoraVuelto } from '@/features/pos/components/visual/CalculadoraVuelto'
import { useCarritoStore } from '@/features/pos/stores/carritoStore'
import { formatoClp } from '@/shared/utils/formatoClp'

const recibido = () => useCarritoStore.getState().montoRecibido

// cada billete o moneda suma al monto recibido: el cliente los va pasando de a uno
describe('CalculadoraVuelto', () => {
  beforeEach(() => {
    useCarritoStore.getState().fijarMontoRecibido(0)
  })

  afterEach(() => {
    cleanup()
    useCarritoStore.getState().fijarMontoRecibido(0)
  })

  it('suma cada billete al monto recibido en vez de reemplazarlo', () => {
    render(<CalculadoraVuelto total={2500} />)
    const mil = screen.getByRole('button', { name: formatoClp(1000) })

    fireEvent.click(mil)
    fireEvent.click(mil)
    fireEvent.click(screen.getByRole('button', { name: formatoClp(500) }))

    expect(recibido()).toBe(2500)
  })
})

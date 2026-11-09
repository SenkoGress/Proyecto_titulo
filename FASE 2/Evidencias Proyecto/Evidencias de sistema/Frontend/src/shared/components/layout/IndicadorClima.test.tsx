// src/shared/components/layout/IndicadorClima.test.tsx
import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { IndicadorClima } from '@/shared/components/layout/IndicadorClima'
import { useClima } from '@/features/clima/hooks/useClima'

vi.mock('@/features/clima/hooks/useClima', () => ({ useClima: vi.fn() }))

const climaFalso = {
  lugar: 'Santiago',
  temperatura: 20,
  maxima: 24,
  minima: 11,
  probabilidadLluvia: 0,
  codigo: 1,
  medidoA: new Date('2026-11-09T20:00:00Z'),
}

function montar(hayClima: boolean) {
  vi.mocked(useClima).mockReturnValue({ data: hayClima ? climaFalso : undefined } as ReturnType<
    typeof useClima
  >)
  return render(<IndicadorClima conSeparador />)
}

describe('IndicadorClima', () => {
  it('muestra la temperatura con su separador', () => {
    const { container } = montar(true)
    expect(container.textContent).toContain('20°')
    expect(container.querySelector('.MuiDivider-root')).toBeInTheDocument()
  })

  // sin comuna o sin internet el clima no se dibuja, y el separador tampoco: puesto en la barra
  // quedaba una linea vertical suelta al lado del reloj
  it('sin clima no deja el separador suelto', () => {
    const { container } = montar(false)
    expect(container.querySelector('.MuiDivider-root')).not.toBeInTheDocument()
    expect(container).toBeEmptyDOMElement()
  })
})

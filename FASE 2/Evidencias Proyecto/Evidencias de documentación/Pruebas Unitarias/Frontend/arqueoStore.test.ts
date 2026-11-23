// src/features/caja/stores/arqueoStore.test.ts
import { beforeEach, describe, expect, it } from 'vitest'
import { useArqueoStore } from '@/features/caja/stores/arqueoStore'

const arqueo = () => useArqueoStore.getState()

// El arqueo es ciego: el cajero cuenta sin ver lo que el sistema espera. Si la comparacion se
// queda a la vista despues de revelarla, el conteo se puede ajustar hasta que cuadre y el arqueo
// deja de medir lo que existe para medir
describe('arqueo ciego', () => {
  beforeEach(() => arqueo().limpiar())

  it('parte sin revelar', () => {
    expect(arqueo().cuadraturaRevelada).toBe(false)
  })

  it('revelar muestra la comparacion', () => {
    arqueo().revelarCuadratura()

    expect(arqueo().cuadraturaRevelada).toBe(true)
  })

  it('cambiar lo contado la vuelve a tapar', () => {
    arqueo().fijarCantidad(1000, 5)
    arqueo().revelarCuadratura()

    arqueo().fijarCantidad(1000, 6)

    expect(arqueo().cuadraturaRevelada).toBe(false)
  })

  it('tambien al corregir otra denominacion', () => {
    arqueo().revelarCuadratura()

    arqueo().fijarCantidad(500, 2)

    expect(arqueo().cuadraturaRevelada).toBe(false)
  })

  it('empezar de nuevo deja todo en cero y sin revelar', () => {
    arqueo().fijarCantidad(1000, 3)
    arqueo().revelarCuadratura()

    arqueo().limpiar()

    expect(arqueo().cantidades[1000]).toBe(0)
    expect(arqueo().cuadraturaRevelada).toBe(false)
  })
})

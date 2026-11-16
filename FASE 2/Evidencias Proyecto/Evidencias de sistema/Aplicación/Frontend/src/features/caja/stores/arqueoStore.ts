// src/features/caja/stores/arqueoStore.ts
import { create } from 'zustand'
import { DENOMINACIONES } from '@/features/caja/utils/denominaciones'

type ArqueoState = {
  cantidades: Record<number, number> // valor de la denominacion -> cuantas hay
  cuadraturaRevelada: boolean // arqueo ciego: el monto esperado se oculta hasta revisar

  fijarCantidad: (valor: number, cantidad: number) => void
  limpiar: () => void
  revelarCuadratura: () => void
}

// cantidades en 0 para empezar a contar
const cantidadesVacias = Object.fromEntries(DENOMINACIONES.map((d) => [d.valor, 0]))

// arqueo ciego: el cajero cuenta sin ver el monto que el sistema espera
export const useArqueoStore = create<ArqueoState>((set) => ({
  cantidades: cantidadesVacias,
  cuadraturaRevelada: false,

  fijarCantidad: (valor, cantidad) =>
    set((estado) => ({
      cantidades: { ...estado.cantidades, [valor]: Math.max(0, Math.floor(cantidad) || 0) },
    })),

  // F7: limpiar el conteo (por si se cuenta de nuevo)
  limpiar: () => set({ cantidades: cantidadesVacias, cuadraturaRevelada: false }),

  revelarCuadratura: () => set({ cuadraturaRevelada: true }),
}))

// total fisico contado segun las cantidades ingresadas
export function useTotalContado(): number {
  return useArqueoStore((estado) =>
    DENOMINACIONES.reduce((acumulado, d) => acumulado + d.valor * (estado.cantidades[d.valor] ?? 0), 0),
  )
}

// piezas fisicas totales (billetes + monedas), solo para mostrar
export function usePiezasContadas(): number {
  return useArqueoStore((estado) => Object.values(estado.cantidades).reduce((a, b) => a + b, 0))
}

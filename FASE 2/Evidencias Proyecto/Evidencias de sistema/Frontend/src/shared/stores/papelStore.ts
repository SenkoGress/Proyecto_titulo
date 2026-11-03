// src/shared/stores/papelStore.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AnchoPapel } from '@/shared/utils/papelTermico'

type PapelState = {
  ancho: AnchoPapel
  cambiarAncho: (ancho: AnchoPapel) => void
}

// se guarda en el navegador: el rollo depende de la impresora de este equipo y no del local
export const usePapelStore = create<PapelState>()(
  persist(
    (set) => ({
      ancho: 80,
      cambiarAncho: (ancho) => set({ ancho }),
    }),
    { name: 'gestock-papel' },
  ),
)

// para las funciones de impresion, que no son componentes
export function anchoPapelActual(): AnchoPapel {
  return usePapelStore.getState().ancho
}

// src/shared/stores/modoVistaStore.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// visual: simple / tecnico: con detalle
export type ModoVista = 'visual' | 'tecnico'

type ModoVistaState = {
  modo: ModoVista
  cambiarModo: (modo: ModoVista) => void
}

// se guarda en el navegador (el backend no guarda preferencias)
export const useModoVistaStore = create<ModoVistaState>()(
  persist(
    (set) => ({
      modo: 'visual',
      cambiarModo: (modo) => set({ modo }),
    }),
    { name: 'gestock-modo-vista' },
  ),
)

// saber si esta en modo tecnico
export function useEsModoTecnico(): boolean {
  return useModoVistaStore((estado) => estado.modo === 'tecnico')
}

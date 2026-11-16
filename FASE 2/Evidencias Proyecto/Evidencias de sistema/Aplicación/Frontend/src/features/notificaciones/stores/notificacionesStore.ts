// src/features/notificaciones/stores/notificacionesStore.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type NotificacionesState = {
  vistas: string[]
  marcarVistas: (ids: string[]) => void
  limpiar: () => void
}

// el backend no guarda si una alerta fue leida, asi que se marca en el equipo
export const useNotificacionesStore = create<NotificacionesState>()(
  persist(
    (set) => ({
      vistas: [],
      marcarVistas: (ids) => set((estado) => ({ vistas: [...new Set([...estado.vistas, ...ids])] })),
      limpiar: () => set({ vistas: [] }),
    }),
    { name: 'gestock-notificaciones-vistas' },
  ),
)

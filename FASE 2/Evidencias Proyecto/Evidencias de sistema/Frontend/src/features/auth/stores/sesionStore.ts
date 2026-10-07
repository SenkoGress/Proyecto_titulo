// src/features/auth/stores/sesionStore.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Usuario } from '@/features/auth/types'

type SesionState = {
  token: string | null
  usuario: Usuario | null
  iniciar: (token: string, usuario: Usuario) => void
  cerrar: () => void
}

// la sesion queda en el navegador para no pedir la clave en cada recarga
export const useSesionStore = create<SesionState>()(
  persist(
    (set) => ({
      token: null,
      usuario: null,
      iniciar: (token, usuario) => set({ token, usuario }),
      cerrar: () => set({ token: null, usuario: null }),
    }),
    { name: 'gestock-sesion' },
  ),
)

export function useUsuario(): Usuario | null {
  return useSesionStore((estado) => estado.usuario)
}

export function useHaySesion(): boolean {
  return useSesionStore((estado) => estado.token !== null)
}

export function useEsAdmin(): boolean {
  return useSesionStore((estado) => estado.usuario?.rol === 'admin')
}

// para leer el token fuera de react (lo usa el interceptor de axios)
export function tokenActual(): string | null {
  return useSesionStore.getState().token
}

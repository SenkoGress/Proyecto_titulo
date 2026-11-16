// src/shared/stores/temaStore.ts
import { useEffect, useState } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ModoTema } from '@/app/theme/theme'

// "sistema" sigue la preferencia del equipo
export type PreferenciaTema = ModoTema | 'sistema'

type TemaState = {
  preferencia: PreferenciaTema
  cambiarPreferencia: (preferencia: PreferenciaTema) => void
}

// se guarda en el navegador (el backend no guarda preferencias de interfaz)
export const useTemaStore = create<TemaState>()(
  persist(
    (set) => ({
      preferencia: 'claro',
      cambiarPreferencia: (preferencia) => set({ preferencia }),
    }),
    { name: 'gestock-tema' },
  ),
)

const CONSULTA_OSCURO = '(prefers-color-scheme: dark)'

// escucha si el equipo esta en modo oscuro
function usePrefiereOscuro(): boolean {
  const [oscuro, setOscuro] = useState(() => window.matchMedia(CONSULTA_OSCURO).matches)

  useEffect(() => {
    const consulta = window.matchMedia(CONSULTA_OSCURO)
    const alCambiar = (evento: MediaQueryListEvent) => setOscuro(evento.matches)

    consulta.addEventListener('change', alCambiar)
    return () => consulta.removeEventListener('change', alCambiar)
  }, [])

  return oscuro
}

// el modo que se aplica de verdad, ya resuelto
export function useModoTema(): ModoTema {
  const preferencia = useTemaStore((estado) => estado.preferencia)
  const prefiereOscuro = usePrefiereOscuro()

  if (preferencia === 'sistema') return prefiereOscuro ? 'oscuro' : 'claro'
  return preferencia
}

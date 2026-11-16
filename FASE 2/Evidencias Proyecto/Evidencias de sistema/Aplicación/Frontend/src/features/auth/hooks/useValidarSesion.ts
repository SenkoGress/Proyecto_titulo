// src/features/auth/hooks/useValidarSesion.ts
import { useEffect } from 'react'
import { env } from '@/config/env'
import { obtenerPerfil } from '@/features/auth/api/auth.api'
import { useSesionStore } from '@/features/auth/stores/sesionStore'

// al recargar se revisa que el token guardado siga sirviendo
export function useValidarSesion() {
  useEffect(() => {
    if (!env.authActiva) return

    const { token, iniciar } = useSesionStore.getState()
    if (!token) return

    // si el token ya no vale, el interceptor cierra la sesion y manda al login
    obtenerPerfil()
      .then((usuario) => iniciar(token, usuario))
      .catch(() => {})
  }, [])
}

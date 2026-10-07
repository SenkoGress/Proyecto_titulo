// src/features/auth/hooks/useAuth.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { iniciarSesion, registrarUsuario } from '@/features/auth/api/auth.api'
import { useSesionStore } from '@/features/auth/stores/sesionStore'

export function useIniciarSesion() {
  const iniciar = useSesionStore((estado) => estado.iniciar)

  return useMutation({
    mutationFn: iniciarSesion,
    onSuccess: (datos) => iniciar(datos.token, datos.usuario),
  })
}

export function useRegistrarUsuario() {
  const iniciar = useSesionStore((estado) => estado.iniciar)

  return useMutation({
    mutationFn: registrarUsuario,
    onSuccess: (datos) => iniciar(datos.token, datos.usuario),
  })
}

// al salir se borra la cache: el siguiente usuario no deberia ver datos del anterior
export function useCerrarSesion() {
  const cerrar = useSesionStore((estado) => estado.cerrar)
  const clienteQuery = useQueryClient()

  return () => {
    cerrar()
    clienteQuery.clear()
  }
}

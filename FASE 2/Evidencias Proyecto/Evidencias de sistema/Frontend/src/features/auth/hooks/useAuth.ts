// src/features/auth/hooks/useAuth.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { crearUsuario, iniciarSesion, obtenerUsuarios } from '@/features/auth/api/auth.api'
import { useSesionStore } from '@/features/auth/stores/sesionStore'

export function useIniciarSesion() {
  const iniciar = useSesionStore((estado) => estado.iniciar)

  return useMutation({
    mutationFn: iniciarSesion,
    onSuccess: (datos) => iniciar(datos.token, datos.usuario),
  })
}

// la gente del local, solo la pide el admin
export function useUsuarios() {
  return useQuery({
    queryKey: ['auth', 'usuarios'],
    queryFn: obtenerUsuarios,
  })
}

export function useCrearUsuario() {
  const clienteQuery = useQueryClient()

  return useMutation({
    mutationFn: crearUsuario,
    onSuccess: () => clienteQuery.invalidateQueries({ queryKey: ['auth', 'usuarios'] }),
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

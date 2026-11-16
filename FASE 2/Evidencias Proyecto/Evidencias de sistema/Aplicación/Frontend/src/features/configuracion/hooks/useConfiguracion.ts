// src/features/configuracion/hooks/useConfiguracion.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  guardarCorreo,
  guardarMargen,
  obtenerCorreo,
  obtenerMargen,
} from '@/features/configuracion/api/configuracion.api'
import { VIGENCIA_LARGA_MS } from '@/lib/query/queryClient'
import { usePuedeAdministrar } from '@/features/auth/stores/sesionStore'

// margen de ganancia del tenant
export function useMargen() {
  return useQuery({
    queryKey: ['configuracion', 'margen'],
    queryFn: obtenerMargen,
    staleTime: VIGENCIA_LARGA_MS,
  })
}

export function useGuardarMargen() {
  const clienteQuery = useQueryClient()

  return useMutation({
    mutationFn: guardarMargen,
    onSuccess: () => {
      clienteQuery.invalidateQueries({ queryKey: ['configuracion', 'margen'] })
    },
  })
}

// correo de ordenes de compra
export function useCorreo() {
  return useQuery({
    queryKey: ['configuracion', 'correo'],
    queryFn: obtenerCorreo,
    staleTime: VIGENCIA_LARGA_MS,
    enabled: usePuedeAdministrar(), // ruta solo de admin
  })
}

export function useGuardarCorreo() {
  const clienteQuery = useQueryClient()

  return useMutation({
    mutationFn: (variables: {
      correo: string
      envioAutomatico: boolean
      diaEnvio: number
      horaEnvio: string
    }) => guardarCorreo(variables.correo, variables.envioAutomatico, variables.diaEnvio, variables.horaEnvio),
    onSuccess: () => {
      clienteQuery.invalidateQueries({ queryKey: ['configuracion', 'correo'] })
    },
  })
}

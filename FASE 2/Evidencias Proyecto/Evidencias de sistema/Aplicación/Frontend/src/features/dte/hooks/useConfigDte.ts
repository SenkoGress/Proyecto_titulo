// src/features/dte/hooks/useConfigDte.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  enviarComprobantePorCorreo,
  guardarConfigDte,
  obtenerComprobante,
  obtenerConfigDte,
} from '@/features/dte/api/dte.api'

// datos del local, casi nunca cambian
export function useConfigDte() {
  return useQuery({
    queryKey: ['dte', 'config'],
    queryFn: obtenerConfigDte,
    staleTime: Infinity,
  })
}

// guardar modelo de emision y datos del emisor
export function useGuardarConfigDte() {
  const clienteQuery = useQueryClient()

  return useMutation({
    mutationFn: guardarConfigDte,
    onSuccess: () => {
      clienteQuery.invalidateQueries({ queryKey: ['dte', 'config'] })
    },
  })
}

// comprobante de una venta ya emitida
export function useComprobante(dteId: string | undefined) {
  return useQuery({
    queryKey: ['dte', 'comprobante', dteId],
    queryFn: () => obtenerComprobante(dteId as string),
    enabled: Boolean(dteId),
    staleTime: Infinity, // un dte emitido ya no cambia
  })
}

// envio del comprobante al correo del cliente
export function useEnviarComprobante() {
  return useMutation({
    mutationFn: (variables: { correo: string; dteId?: string; ventaId?: string }) =>
      enviarComprobantePorCorreo(variables.correo, variables.dteId, variables.ventaId),
  })
}

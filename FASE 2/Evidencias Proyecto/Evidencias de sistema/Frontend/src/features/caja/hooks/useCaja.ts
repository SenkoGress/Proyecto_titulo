// src/features/caja/hooks/useCaja.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  abrirCaja,
  cerrarCaja,
  obtenerHistorialCaja,
  obtenerResumenCaja,
  registrarMovimiento,
} from '@/features/caja/api/caja.api'
import type { TipoMovimiento } from '@/features/caja/types'
import { INTERVALO_REFRESCO_MS } from '@/lib/query/queryClient'

// turno actual: null si no hay ninguno abierto
export function useResumenCaja() {
  return useQuery({
    queryKey: ['caja', 'resumen'],
    queryFn: obtenerResumenCaja,
    refetchInterval: INTERVALO_REFRESCO_MS,
  })
}

// abrir turno
export function useAbrirCaja() {
  const clienteQuery = useQueryClient()

  return useMutation({
    mutationFn: abrirCaja,
    onSuccess: () => {
      clienteQuery.invalidateQueries({ queryKey: ['caja', 'resumen'] })
    },
  })
}

// cerrar turno (balance z)
export function useCerrarCaja() {
  const clienteQuery = useQueryClient()

  return useMutation({
    mutationFn: (variables: { montoRealEfectivo: number; observaciones?: string }) =>
      cerrarCaja(variables.montoRealEfectivo, variables.observaciones),
    onSuccess: () => {
      clienteQuery.invalidateQueries({ queryKey: ['caja', 'resumen'] })
    },
  })
}

// ingreso o egreso manual
export function useRegistrarMovimiento() {
  const clienteQuery = useQueryClient()

  return useMutation({
    mutationFn: (variables: { tipo: TipoMovimiento; monto: number; motivo: string }) =>
      registrarMovimiento(variables.tipo, variables.monto, variables.motivo),
    onSuccess: () => {
      clienteQuery.invalidateQueries({ queryKey: ['caja', 'resumen'] })
    },
  })
}

// historial de cierres de turno
export function useHistorialCaja() {
  return useQuery({
    queryKey: ['caja', 'historial'],
    queryFn: obtenerHistorialCaja,
  })
}

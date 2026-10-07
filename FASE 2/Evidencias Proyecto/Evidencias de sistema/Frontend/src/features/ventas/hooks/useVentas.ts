// src/features/ventas/hooks/useVentas.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  obtenerDtesEmitidos,
  obtenerTransacciones,
  registrarDevolucion,
} from '@/features/ventas/api/ventas.api'
import { INTERVALO_REFRESCO_MS, VIGENCIA_LARGA_MS } from '@/lib/query/queryClient'

// ventas y devoluciones registradas
export function useTransacciones() {
  return useQuery({
    queryKey: ['pos', 'transacciones'],
    queryFn: obtenerTransacciones,
    refetchInterval: INTERVALO_REFRESCO_MS,
  })
}

// un dte emitido ya no cambia, no vale la pena repedirlos seguido
export function useDtesEmitidos() {
  return useQuery({
    queryKey: ['dte', 'lista'],
    queryFn: obtenerDtesEmitidos,
    staleTime: VIGENCIA_LARGA_MS,
  })
}

// devolucion: cambia stock, ventas y documentos emitidos
export function useDevolucion() {
  const clienteQuery = useQueryClient()

  return useMutation({
    mutationFn: registrarDevolucion,
    onSuccess: () => {
      clienteQuery.invalidateQueries({ queryKey: ['pos', 'transacciones'] })
      clienteQuery.invalidateQueries({ queryKey: ['dte', 'lista'] })
      clienteQuery.invalidateQueries({ queryKey: ['pos', 'productos'] })
      clienteQuery.invalidateQueries({ queryKey: ['inventario'] })
      clienteQuery.invalidateQueries({ queryKey: ['caja', 'resumen'] })
    },
  })
}

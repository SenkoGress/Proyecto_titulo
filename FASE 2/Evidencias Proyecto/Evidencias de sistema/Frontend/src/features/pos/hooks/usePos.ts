// src/features/pos/hooks/usePos.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  obtenerEstadoPos,
  obtenerProductos,
  registrarVenta,
  sincronizarVentas,
} from '@/features/pos/api/pos.api'
import { env } from '@/config/env'
import { INTERVALO_REFRESCO_MS } from '@/lib/query/queryClient'

// productos
export function useProductos() {
  return useQuery({
    queryKey: ['pos', 'productos'],
    queryFn: obtenerProductos,
  })
}

// estado de conexion
export function useEstadoPos() {
  return useQuery({
    queryKey: ['pos', 'estado'],
    queryFn: obtenerEstadoPos,
    refetchInterval: INTERVALO_REFRESCO_MS,
  })
}

// registrar venta y refrescar stock
export function useRegistrarVenta() {
  const clienteQuery = useQueryClient()

  return useMutation({
    mutationFn: registrarVenta,
    onSuccess: () => {
      clienteQuery.invalidateQueries({ queryKey: ['pos', 'productos'] })
      clienteQuery.invalidateQueries({ queryKey: ['pos', 'estado'] })
    },
  })
}

// sincronizar con la nube
export function useSincronizar() {
  const clienteQuery = useQueryClient()

  return useMutation({
    mutationFn: () => sincronizarVentas(env.tenantId),
    onSuccess: () => {
      clienteQuery.invalidateQueries({ queryKey: ['pos', 'estado'] })
      clienteQuery.invalidateQueries({ queryKey: ['pos', 'productos'] })
    },
  })
}

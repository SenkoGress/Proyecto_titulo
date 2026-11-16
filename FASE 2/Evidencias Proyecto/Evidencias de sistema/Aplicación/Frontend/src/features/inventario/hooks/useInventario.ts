// src/features/inventario/hooks/useInventario.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ajustarStock,
  crearProducto,
  editarProducto,
  obtenerHistorialProducto,
  obtenerInventario,
  obtenerMermas,
  obtenerVencimientos,
  registrarMerma,
} from '@/features/inventario/api/inventario.api'
import { VIGENCIA_LARGA_MS } from '@/lib/query/queryClient'

// catalogo completo de inventario
export function useInventario() {
  return useQuery({
    queryKey: ['inventario'],
    queryFn: obtenerInventario,
  })
}

// semaforo sanitario de vencimientos
export function useVencimientos() {
  return useQuery({
    queryKey: ['inventario', 'vencimientos'],
    queryFn: obtenerVencimientos,
    staleTime: VIGENCIA_LARGA_MS,
  })
}

// solo se pide cuando hay un producto elegido
export function useHistorialProducto(id: string | null) {
  return useQuery({
    queryKey: ['inventario', 'historial', id],
    queryFn: () => obtenerHistorialProducto(id as string),
    enabled: Boolean(id),
    staleTime: VIGENCIA_LARGA_MS,
  })
}

export function useMermas() {
  return useQuery({
    queryKey: ['inventario', 'mermas'],
    queryFn: obtenerMermas,
    staleTime: VIGENCIA_LARGA_MS,
  })
}

// todo lo que mueve stock afecta tambien al semaforo y al punto de reposicion
function useRefrescarInventario() {
  const clienteQuery = useQueryClient()

  return () => {
    clienteQuery.invalidateQueries({ queryKey: ['inventario'] })
    clienteQuery.invalidateQueries({ queryKey: ['pos', 'productos'] })
    clienteQuery.invalidateQueries({ queryKey: ['replenishment'] })
  }
}

export function useCrearProducto() {
  const refrescar = useRefrescarInventario()

  return useMutation({
    mutationFn: crearProducto,
    onSuccess: refrescar,
  })
}

export function useEditarProducto() {
  const refrescar = useRefrescarInventario()

  return useMutation({
    mutationFn: editarProducto,
    onSuccess: refrescar,
  })
}

export function useAjustarStock() {
  const refrescar = useRefrescarInventario()

  return useMutation({
    mutationFn: ajustarStock,
    onSuccess: refrescar,
  })
}

export function useRegistrarMerma() {
  const clienteQuery = useQueryClient()
  const refrescar = useRefrescarInventario()

  return useMutation({
    mutationFn: registrarMerma,
    onSuccess: () => {
      refrescar()
      clienteQuery.invalidateQueries({ queryKey: ['inventario', 'mermas'] })
    },
  })
}

// src/features/proveedores/hooks/useProveedores.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  actualizarProveedor,
  crearProveedor,
  obtenerProveedores,
} from '@/features/proveedores/api/proveedores.api'
import { obtenerFacturas } from '@/features/invoices/api/invoices.api'
import { VIGENCIA_LARGA_MS } from '@/lib/query/queryClient'
import type { EdicionProveedor } from '@/features/proveedores/types'

// directorio de proveedores
export function useProveedores() {
  return useQuery({
    queryKey: ['proveedores'],
    queryFn: obtenerProveedores,
    staleTime: VIGENCIA_LARGA_MS,
  })
}

// facturas ya confirmadas, para saber la ultima de cada proveedor
export function useFacturasProveedores() {
  return useQuery({
    queryKey: ['invoices', 'historial'],
    queryFn: obtenerFacturas,
    staleTime: VIGENCIA_LARGA_MS,
  })
}

// agregar proveedor
export function useCrearProveedor() {
  const clienteQuery = useQueryClient()

  return useMutation({
    mutationFn: crearProveedor,
    onSuccess: () => {
      clienteQuery.invalidateQueries({ queryKey: ['proveedores'] })
    },
  })
}

// editar proveedor
export function useActualizarProveedor() {
  const clienteQuery = useQueryClient()

  return useMutation({
    mutationFn: (variables: { id: string; cambios: EdicionProveedor }) =>
      actualizarProveedor(variables.id, variables.cambios),
    onSuccess: () => {
      clienteQuery.invalidateQueries({ queryKey: ['proveedores'] })
    },
  })
}

// src/features/invoices/hooks/useInvoices.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  confirmarFactura,
  escanearFactura,
  obtenerPendientes,
  procesarPendientes,
} from '@/features/invoices/api/invoices.api'

// paso 1: escanear la factura con ocr
export function useEscanearFactura() {
  return useMutation({
    mutationFn: (variables: { base64: string; nombre: string; tipo: string }) =>
      escanearFactura(variables.base64, variables.nombre, variables.tipo),
  })
}

// paso 2: confirmar e ingresar a inventario
export function useConfirmarFactura() {
  const clienteQuery = useQueryClient()

  return useMutation({
    mutationFn: confirmarFactura,
    onSuccess: () => {
      // el stock cambio, refrescamos el catalogo del pos
      clienteQuery.invalidateQueries({ queryKey: ['pos', 'productos'] })
    },
  })
}

// facturas que no se pudieron leer y esperan otro intento
export function usePendientes() {
  return useQuery({
    queryKey: ['invoices', 'pendientes'],
    queryFn: obtenerPendientes,
  })
}

export function useProcesarPendientes() {
  const clienteQuery = useQueryClient()

  return useMutation({
    mutationFn: procesarPendientes,
    onSuccess: () => {
      clienteQuery.invalidateQueries({ queryKey: ['invoices'] })
      clienteQuery.invalidateQueries({ queryKey: ['pos', 'productos'] })
    },
  })
}

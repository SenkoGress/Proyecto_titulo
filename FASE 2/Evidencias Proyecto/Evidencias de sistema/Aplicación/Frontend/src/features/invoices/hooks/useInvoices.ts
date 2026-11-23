// src/features/invoices/hooks/useInvoices.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { trasIngresarFactura } from '@/lib/query/invalidar'
import {
  abrirFacturaDeCola,
  confirmarFactura,
  descartarFacturaDeCola,
  obtenerFacturas,
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
    // el stock cambio y la cola perdio su ticket
    onSuccess: () => trasIngresarFactura(clienteQuery),
  })
}

// abrir una factura que la cola ya leyo, para declarar los vencimientos y confirmarla
export function useAbrirFacturaDeCola() {
  return useMutation({ mutationFn: abrirFacturaDeCola })
}

export function useDescartarFacturaDeCola() {
  const clienteQuery = useQueryClient()

  return useMutation({
    mutationFn: descartarFacturaDeCola,
    onSuccess: () => clienteQuery.invalidateQueries({ queryKey: ['invoices'] }),
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
    onSuccess: () => trasIngresarFactura(clienteQuery),
  })
}

// facturas ya ingresadas, para avisar si una viene repetida
export function useFacturas() {
  return useQuery({
    queryKey: ['invoices', 'registradas'],
    queryFn: obtenerFacturas,
  })
}

// src/features/sii/hooks/useSii.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  correrCertificacion,
  emitirGuia,
  generarRcof,
  obtenerF29,
  obtenerFoliosCaf,
  obtenerGuias,
  obtenerRcof,
} from '@/features/sii/api/sii.api'
import { VIGENCIA_LARGA_MS } from '@/lib/query/queryClient'

// folios autorizados disponibles
export function useFoliosCaf() {
  return useQuery({
    queryKey: ['dte', 'caf'],
    queryFn: obtenerFoliosCaf,
    staleTime: VIGENCIA_LARGA_MS,
  })
}

// pre-liquidacion f29 del periodo elegido
export function useF29(periodo: string, tasaPpm: number) {
  return useQuery({
    queryKey: ['dte', 'f29', periodo, tasaPpm],
    queryFn: () => obtenerF29(periodo, tasaPpm),
  })
}

export function useRcof() {
  return useQuery({
    queryKey: ['dte', 'rcof'],
    queryFn: obtenerRcof,
    staleTime: VIGENCIA_LARGA_MS,
  })
}

export function useGenerarRcof() {
  const clienteQuery = useQueryClient()

  return useMutation({
    mutationFn: generarRcof,
    onSuccess: () => {
      clienteQuery.invalidateQueries({ queryKey: ['dte', 'rcof'] })
    },
  })
}

export function useGuias() {
  return useQuery({
    queryKey: ['dte', 'guias'],
    queryFn: obtenerGuias,
    staleTime: VIGENCIA_LARGA_MS,
  })
}

// emitir guia consume un folio caf de tipo 52
export function useEmitirGuia() {
  const clienteQuery = useQueryClient()

  return useMutation({
    mutationFn: emitirGuia,
    onSuccess: () => {
      clienteQuery.invalidateQueries({ queryKey: ['dte', 'guias'] })
      clienteQuery.invalidateQueries({ queryKey: ['dte', 'caf'] })
    },
  })
}

// el set de prueba emite documentos reales y gasta folios
export function useCertificacion() {
  const clienteQuery = useQueryClient()

  return useMutation({
    mutationFn: correrCertificacion,
    onSuccess: () => {
      clienteQuery.invalidateQueries({ queryKey: ['dte', 'caf'] })
      clienteQuery.invalidateQueries({ queryKey: ['dte', 'lista'] })
    },
  })
}

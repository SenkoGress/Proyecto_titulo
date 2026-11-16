// src/features/replenishment/hooks/useReplenishment.ts
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  enviarOrdenesPorCorreo,
  obtenerOrdenesCompra,
  obtenerSugerenciaPedido,
  obtenerVelocidades,
} from '@/features/replenishment/api/replenishment.api'
import { CONFIG_ROP_POR_DEFECTO } from '@/features/replenishment/types'
import { VIGENCIA_LARGA_MS } from '@/lib/query/queryClient'
import { usePuedeAdministrar } from '@/features/auth/stores/sesionStore'
import type { ConfigRop } from '@/features/replenishment/types'

// sugerencia de pedido segun el punto de reorden (rop). solo la consulta, no genera ordenes de compra.
// la ruta es solo de admin: para el cajero la consulta queda apagada
export function useSugerenciaPedido(config: ConfigRop = CONFIG_ROP_POR_DEFECTO) {
  return useQuery({
    queryKey: ['replenishment', 'sugerencia', config],
    queryFn: () => obtenerSugerenciaPedido(config),
    staleTime: VIGENCIA_LARGA_MS,
    enabled: usePuedeAdministrar(),
  })
}

// ordenes de compra generadas
export function useOrdenesCompra() {
  return useQuery({
    queryKey: ['replenishment', 'ordenes'],
    queryFn: obtenerOrdenesCompra,
  })
}

// enviar las ordenes sugeridas por correo
export function useEnviarOrdenesPorCorreo() {
  return useMutation({
    mutationFn: enviarOrdenesPorCorreo,
  })
}

// cuantos dias de venta se miran para calcular la rotacion
const DIAS_ANALISIS = 30

// rotacion de todo el catalogo. la usa el panel de sugerencias
export function useVelocidades() {
  return useQuery({
    queryKey: ['replenishment', 'velocidad', DIAS_ANALISIS],
    queryFn: () => obtenerVelocidades(DIAS_ANALISIS),
    staleTime: VIGENCIA_LARGA_MS,
    enabled: usePuedeAdministrar(),
  })
}

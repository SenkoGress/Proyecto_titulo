// src/features/replenishment/hooks/useReplenishment.ts
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  enviarOrdenesPorCorreo,
  obtenerOrdenesCompra,
  obtenerSugerenciaPedido,
} from '@/features/replenishment/api/replenishment.api'
import { CONFIG_ROP_POR_DEFECTO } from '@/features/replenishment/types'
import { VIGENCIA_LARGA_MS } from '@/lib/query/queryClient'
import type { ConfigRop } from '@/features/replenishment/types'

// sugerencia de pedido segun el punto de reorden (rop).
// cada llamada escribe filas en purchase_orders del backend, asi que no conviene repetirla al navegar
export function useSugerenciaPedido(config: ConfigRop = CONFIG_ROP_POR_DEFECTO) {
  return useQuery({
    queryKey: ['replenishment', 'sugerencia', config],
    queryFn: () => obtenerSugerenciaPedido(config),
    staleTime: VIGENCIA_LARGA_MS,
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

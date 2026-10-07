// src/features/replenishment/api/replenishment.api.ts
import { httpClient } from '@/lib/api/httpClient'
import { endpoints } from '@/lib/api/endpoints'
import { CONFIG_ROP_POR_DEFECTO } from '@/features/replenishment/types'
import type { ConfigRop, RespuestaOrdenesCompra, RespuestaSugerencia } from '@/features/replenishment/types'

// sugerencia de reposicion. los 3 parametros van siempre, si no el backend devuelve 0
export async function obtenerSugerenciaPedido(config: ConfigRop = CONFIG_ROP_POR_DEFECTO) {
  const { data } = await httpClient.get<RespuestaSugerencia>(endpoints.replenishment.sugerir, {
    params: {
      analysis_days: config.analysisDays,
      lead_time_days: config.leadTimeDays,
      safety_factor: config.safetyFactor,
    },
  })
  return data.data
}

// ordenes de compra ya generadas (sirve para saber el ultimo pedido de cada proveedor)
export async function obtenerOrdenesCompra() {
  const { data } = await httpClient.get<RespuestaOrdenesCompra>(endpoints.replenishment.ordenesCompra)
  return data.orders
}

// envia por correo las ordenes sugeridas del momento
export async function enviarOrdenesPorCorreo(correoDestino: string) {
  const { data } = await httpClient.post<{ success: boolean; message: string }>(
    endpoints.replenishment.enviarCorreo,
    { recipient_email: correoDestino },
  )
  return data
}

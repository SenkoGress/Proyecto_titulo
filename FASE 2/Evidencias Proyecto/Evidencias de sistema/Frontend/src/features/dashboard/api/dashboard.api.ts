// src/features/dashboard/api/dashboard.api.ts
import { httpClient } from '@/lib/api/httpClient'
import { endpoints } from '@/lib/api/endpoints'
import type { PeriodoDashboard, RespuestaDashboard, RespuestaTendencias } from '@/features/dashboard/types'

// kpis, serie temporal, medios de pago, top productos, categorias y proveedores
export async function obtenerResumenDashboard(periodo: PeriodoDashboard) {
  const { data } = await httpClient.get<RespuestaDashboard>(endpoints.dashboard.resumen, {
    params: { periodo },
  })
  return data.data
}

// tendencias de mercado (mercadolibre / aliexpress)
export async function obtenerTendencias() {
  const { data } = await httpClient.get<RespuestaTendencias>(endpoints.dashboard.tendencias)
  return data.data
}

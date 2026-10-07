// src/features/ventas/api/ventas.api.ts
import { httpClient } from '@/lib/api/httpClient'
import { endpoints } from '@/lib/api/endpoints'
import { env } from '@/config/env'
import type {
  ItemDevolucion,
  RespuestaDevolucion,
  RespuestaDtes,
  RespuestaTransacciones,
} from '@/features/ventas/types'

// ultimas 100 ventas y devoluciones, de la mas nueva a la mas antigua
export async function obtenerTransacciones() {
  const { data } = await httpClient.get<RespuestaTransacciones>(endpoints.pos.transacciones)
  return data.data
}

// documentos tributarios emitidos, para saber que comprobante tiene cada venta
export async function obtenerDtesEmitidos() {
  // esta ruta lee "tenantId" (no tenant_id)
  const { data } = await httpClient.get<RespuestaDtes>(endpoints.dte.lista, {
    params: { tenantId: env.tenantId, limit: 200 },
  })
  return data.data
}

// devuelve una venta: repone el stock y emite nota de credito (dte 61)
export async function registrarDevolucion(variables: {
  ventaId: string
  motivo: string
  items?: ItemDevolucion[]
}) {
  const { data } = await httpClient.post<RespuestaDevolucion>(endpoints.pos.devolucion, {
    tenant_id: env.tenantId,
    usuario_id: env.usuarioId,
    venta_id: variables.ventaId,
    motivo: variables.motivo,
    items_devolucion: variables.items,
  })
  return data
}

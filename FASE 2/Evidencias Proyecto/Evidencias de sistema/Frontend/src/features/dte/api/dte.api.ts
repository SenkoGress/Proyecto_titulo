// src/features/dte/api/dte.api.ts
import { httpClient } from '@/lib/api/httpClient'
import { endpoints } from '@/lib/api/endpoints'
import { env } from '@/config/env'
import type { EdicionConfigDte, RespuestaComprobante, RespuestaConfigDte } from '@/features/dte/types'

// datos del emisor (nombre del local, comuna, rut)
export async function obtenerConfigDte() {
  // esta ruta lee "tenantId" (no tenant_id)
  const { data } = await httpClient.get<RespuestaConfigDte>(endpoints.dte.config, {
    params: { tenantId: env.tenantId },
  })
  return data.data
}

// guardar el modelo de emision y los datos del emisor
export async function guardarConfigDte(cambios: EdicionConfigDte) {
  const { data } = await httpClient.post<RespuestaConfigDte & { message: string }>(endpoints.dte.config, {
    tenantId: env.tenantId,
    ...cambios,
  })
  return data
}

// comprobante listo para entregar al cliente (ticket termico)
export async function obtenerComprobante(dteId: string) {
  const { data } = await httpClient.get<RespuestaComprobante>(endpoints.dte.comprobante(dteId))
  return data.data
}

// xml oficial firmado del dte
export async function descargarXmlDte(dteId: string) {
  const { data } = await httpClient.get<string>(endpoints.dte.xml(dteId), { responseType: 'text' })
  return data
}

// despacho del comprobante al correo del cliente
export async function enviarComprobantePorCorreo(correo: string, dteId?: string, ventaId?: string) {
  const { data } = await httpClient.post<{ success: boolean; message: string }>(
    endpoints.dte.enviarCorreo,
    { email: correo, dteId, ventaId },
  )
  return data
}

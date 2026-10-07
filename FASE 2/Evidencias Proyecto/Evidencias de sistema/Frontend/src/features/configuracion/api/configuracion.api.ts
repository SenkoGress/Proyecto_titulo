// src/features/configuracion/api/configuracion.api.ts
import { httpClient } from '@/lib/api/httpClient'
import { endpoints } from '@/lib/api/endpoints'
import { env } from '@/config/env'
import type { RespuestaCorreo, RespuestaGuardado, RespuestaMargen } from '@/features/configuracion/types'

// margen que se aplica al costo de las facturas para calcular el precio de venta
export async function obtenerMargen() {
  const { data } = await httpClient.get<RespuestaMargen>(endpoints.configuracion.margen)
  return data.margin
}

export async function guardarMargen(margen: number) {
  const { data } = await httpClient.post<RespuestaGuardado>(endpoints.configuracion.margen, {
    tenant_id: env.tenantId,
    margin: margen,
  })
  return data
}

// correo al que se mandan las ordenes de compra, y si se envian solas
export async function obtenerCorreo() {
  const { data } = await httpClient.get<RespuestaCorreo>(endpoints.configuracion.correo)
  return data
}

export async function guardarCorreo(correo: string, envioAutomatico: boolean) {
  const { data } = await httpClient.post<RespuestaGuardado>(endpoints.configuracion.correo, {
    tenant_id: env.tenantId,
    email: correo,
    auto_send: envioAutomatico,
  })
  return data
}

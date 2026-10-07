// src/features/auth/api/auth.api.ts
import { httpClient } from '@/lib/api/httpClient'
import { endpoints } from '@/lib/api/endpoints'
import { env } from '@/config/env'
import type { Credenciales, NuevoUsuario, RespuestaSesion } from '@/features/auth/types'

export async function iniciarSesion(credenciales: Credenciales) {
  const { data } = await httpClient.post<RespuestaSesion>(endpoints.auth.login, {
    tenant_id: env.tenantId,
    ...credenciales,
  })
  return data.data
}

export async function registrarUsuario(usuario: NuevoUsuario) {
  const { data } = await httpClient.post<RespuestaSesion>(endpoints.auth.registro, {
    tenant_id: env.tenantId,
    ...usuario,
  })
  return data.data
}

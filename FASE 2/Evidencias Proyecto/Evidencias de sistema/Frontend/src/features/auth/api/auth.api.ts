// src/features/auth/api/auth.api.ts
import { httpClient } from '@/lib/api/httpClient'
import { endpoints } from '@/lib/api/endpoints'
import { env } from '@/config/env'
import type {
  Credenciales,
  NuevoUsuario,
  RespuestaSesion,
  RespuestaUsuarioCreado,
  RespuestaUsuarios,
} from '@/features/auth/types'

export async function iniciarSesion(credenciales: Credenciales) {
  const { data } = await httpClient.post<RespuestaSesion>(endpoints.auth.login, {
    tenant_id: env.tenantId,
    ...credenciales,
  })
  return data.data
}

// el admin crea la cuenta del cajero: no abre sesion, el admin sigue conectado
export async function crearUsuario(usuario: NuevoUsuario) {
  const { data } = await httpClient.post<RespuestaUsuarioCreado>(endpoints.auth.registro, {
    tenant_id: env.tenantId,
    ...usuario,
  })
  return data.data.usuario
}

export async function obtenerUsuarios() {
  const { data } = await httpClient.get<RespuestaUsuarios>(endpoints.auth.usuarios)
  return data.data
}

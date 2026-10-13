// src/features/auth/api/auth.api.ts
import { httpClient } from '@/lib/api/httpClient'
import { endpoints } from '@/lib/api/endpoints'
import { env } from '@/config/env'
import { tenantActual } from '@/features/auth/utils/identidad'
import type {
  CambioDeClave,
  Credenciales,
  NuevoUsuario,
  RespuestaPerfil,
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
    tenant_id: tenantActual(),
    ...usuario,
  })
  return data.data.usuario
}

// quien es el dueno del token guardado
export async function obtenerPerfil() {
  const { data } = await httpClient.get<RespuestaPerfil>(endpoints.auth.perfil)
  return data.data.usuario
}

export async function obtenerUsuarios() {
  const { data } = await httpClient.get<RespuestaUsuarios>(endpoints.auth.usuarios)
  return data.data
}

// cambiar la propia clave, lo puede hacer cualquiera que tenga sesion
export async function cambiarClave(cambio: CambioDeClave) {
  const { data } = await httpClient.put<{ success: boolean; message: string }>(
    endpoints.auth.clave,
    cambio,
  )
  return data
}

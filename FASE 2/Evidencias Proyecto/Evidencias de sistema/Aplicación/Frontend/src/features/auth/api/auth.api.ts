// src/features/auth/api/auth.api.ts
import { httpClient } from '@/lib/api/httpClient'
import { endpoints } from '@/lib/api/endpoints'
import { env } from '@/config/env'
import { tenantActual } from '@/features/auth/utils/identidad'
import type {
  CambioDeClave,
  CambioDeUsuario,
  Credenciales,
  NuevoUsuario,
  RespuestaBaja,
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

// editar a otra persona del local: solo el administrador
export async function editarUsuario(variables: { id: string; cambios: CambioDeUsuario }) {
  const { data } = await httpClient.put<RespuestaUsuarioCreado>(
    endpoints.auth.usuario(variables.id),
    variables.cambios,
  )
  return data.data.usuario
}

// dar de baja: el backend elimina al que no vendio nunca y desactiva al que tiene historial
export async function darDeBajaUsuario(id: string) {
  const { data } = await httpClient.delete<RespuestaBaja>(endpoints.auth.usuario(id))
  return data
}

// cambiar la propia clave, lo puede hacer cualquiera que tenga sesion
export async function cambiarClave(cambio: CambioDeClave) {
  const { data } = await httpClient.put<{ success: boolean; message: string }>(
    endpoints.auth.clave,
    cambio,
  )
  return data
}

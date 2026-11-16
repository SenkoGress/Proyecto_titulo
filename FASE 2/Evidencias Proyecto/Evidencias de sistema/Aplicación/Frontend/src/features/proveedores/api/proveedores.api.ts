// src/features/proveedores/api/proveedores.api.ts
import { httpClient } from '@/lib/api/httpClient'
import { endpoints } from '@/lib/api/endpoints'
import { tenantActual } from '@/features/auth/utils/identidad'
import type {
  EdicionProveedor,
  NuevoProveedor,
  RespuestaCrearProveedor,
  RespuestaProveedores,
} from '@/features/proveedores/types'

// directorio completo, ya viene con productos suministrados y proxima visita calculada
export async function obtenerProveedores() {
  const { data } = await httpClient.get<RespuestaProveedores>(endpoints.proveedores.listar)
  return data.data
}

// alta de proveedor
export async function crearProveedor(proveedor: NuevoProveedor) {
  const { data } = await httpClient.post<RespuestaCrearProveedor>(endpoints.proveedores.crear, {
    tenant_id: tenantActual(),
    ...proveedor,
  })
  return data.data
}

// edicion (el rut no se puede cambiar, es la clave unica del proveedor)
export async function actualizarProveedor(id: string, cambios: EdicionProveedor) {
  const { data } = await httpClient.put<{ success: boolean; message: string }>(
    endpoints.proveedores.actualizar(id),
    { tenant_id: tenantActual(), ...cambios },
  )
  return data
}

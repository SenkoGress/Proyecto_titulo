// src/features/pos/api/pos.api.ts
import { httpClient } from '@/lib/api/httpClient'
import { endpoints } from '@/lib/api/endpoints'
import type {
  EstadoPos,
  PeticionCheckout,
  RespuestaCheckout,
  RespuestaProductos,
} from '@/features/pos/types'

// catalogo del terminal
export async function obtenerProductos() {
  const { data } = await httpClient.get<RespuestaProductos>(endpoints.pos.productos)
  return data.data
}

// estado de conexion
export async function obtenerEstadoPos() {
  const { data } = await httpClient.get<EstadoPos>(endpoints.pos.estado)
  return data
}

// registrar venta
export async function registrarVenta(peticion: PeticionCheckout) {
  const { data } = await httpClient.post<RespuestaCheckout>(endpoints.pos.checkout, peticion)
  return data.data
}

// subir ventas pendientes
export async function sincronizarVentas(tenantId: string) {
  const { data } = await httpClient.post(endpoints.pos.sincronizar, { tenant_id: tenantId })
  return data
}

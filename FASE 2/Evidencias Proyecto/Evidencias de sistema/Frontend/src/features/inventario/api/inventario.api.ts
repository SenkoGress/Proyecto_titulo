// src/features/inventario/api/inventario.api.ts
import { httpClient } from '@/lib/api/httpClient'
import { endpoints } from '@/lib/api/endpoints'
import { env } from '@/config/env'
import type {
  AjusteStock,
  EdicionProducto,
  NuevaMerma,
  NuevoProducto,
  ProductoInventario,
  RespuestaAjusteStock,
  RespuestaHistorialStock,
  RespuestaInventario,
  RespuestaMermas,
  RespuestaVencimientos,
} from '@/features/inventario/types'

// catalogo completo con costos, precios y proveedor
export async function obtenerInventario() {
  const { data } = await httpClient.get<RespuestaInventario>(endpoints.pos.inventario)
  return data.data
}

// semaforo sanitario: solo trae productos con fecha_vencimiento cargada
export async function obtenerVencimientos() {
  const { data } = await httpClient.get<RespuestaVencimientos>(endpoints.pos.vencimientos)
  return data
}

// alta de producto
export async function crearProducto(producto: NuevoProducto) {
  const { data } = await httpClient.post<{ data: ProductoInventario }>(endpoints.pos.productos, {
    tenant_id: env.tenantId,
    ...producto,
  })
  return data.data
}

// editar producto: se mandan solo los campos tocados
export async function editarProducto({ id, cambios }: EdicionProducto) {
  const { data } = await httpClient.put<{ data: ProductoInventario }>(
    endpoints.pos.producto(id),
    cambios,
  )
  return data.data
}

// conteo fisico: se manda el stock contado, el backend calcula la diferencia
export async function ajustarStock({ id, nuevo_stock, motivo, usuario_id }: AjusteStock) {
  const { data } = await httpClient.patch<RespuestaAjusteStock>(endpoints.pos.stockProducto(id), {
    tenant_id: env.tenantId,
    nuevo_stock,
    motivo,
    usuario_id,
  })
  return data.data
}

export async function registrarMerma(merma: NuevaMerma) {
  const { data } = await httpClient.post(endpoints.pos.mermas, {
    tenant_id: env.tenantId,
    ...merma,
  })
  return data
}

export async function obtenerMermas() {
  const { data } = await httpClient.get<RespuestaMermas>(endpoints.pos.mermas)
  return data.data
}

// linea de tiempo de un producto: alta, ingresos, ventas, ajustes y mermas
export async function obtenerHistorialProducto(id: string) {
  const { data } = await httpClient.get<RespuestaHistorialStock>(endpoints.pos.historialProducto(id))
  return data.data
}

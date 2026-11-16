// src/features/inventario/api/inventario.api.ts
import { isAxiosError } from 'axios'
import { httpClient } from '@/lib/api/httpClient'
import { endpoints } from '@/lib/api/endpoints'
import { tenantActual } from '@/features/auth/utils/identidad'
import type {
  FichaExterna,
  ProductoEnCatalogo,
  ResultadoBusqueda,
} from '@/features/inventario/utils/fichaCodigoBarras'
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
    tenant_id: tenantActual(),
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
    tenant_id: tenantActual(),
    nuevo_stock,
    motivo,
    usuario_id,
  })
  return data.data
}

export async function registrarMerma(merma: NuevaMerma) {
  const { data } = await httpClient.post(endpoints.pos.mermas, {
    tenant_id: tenantActual(),
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

// busca la ficha del producto por su codigo de barras. El servidor consulta Open Food Facts y de
// paso avisa si ese codigo ya esta en el catalogo del local. Nunca lanza: un codigo que no esta,
// o Open Food Facts caido, son respuestas normales y la pantalla sigue funcionando a mano
export async function buscarPorCodigoBarras(codigo: string): Promise<ResultadoBusqueda> {
  try {
    const { data } = await httpClient.get<{ data: FichaExterna; en_catalogo: ProductoEnCatalogo }>(
      endpoints.pos.buscarCodigoBarras(codigo.trim()),
      { params: { tenant_id: tenantActual() } },
    )
    return { encontrada: data.data, enCatalogo: data.en_catalogo ?? null, motivo: 'encontrado' }
  } catch (error) {
    const estado = isAxiosError(error) ? error.response?.status : undefined
    const cuerpo = isAxiosError(error)
      ? (error.response?.data as { en_catalogo?: ProductoEnCatalogo } | undefined)
      : undefined

    return {
      encontrada: null,
      enCatalogo: cuerpo?.en_catalogo ?? null,
      motivo: estado === 404 ? 'no_esta' : 'sin_conexion',
    }
  }
}

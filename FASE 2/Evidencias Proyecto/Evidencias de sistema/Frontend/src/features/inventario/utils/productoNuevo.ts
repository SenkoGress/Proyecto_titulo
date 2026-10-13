// src/features/inventario/utils/productoNuevo.ts
import { parsearFechaBackend } from '@/shared/utils/fechaBackend'
import type { ProductoInventario } from '@/features/inventario/types'
import type { CierreHistorial } from '@/features/caja/types'

// la fecha del ultimo cierre de caja, que es hasta donde dura la etiqueta
export function ultimoCierreZ(historial: CierreHistorial[] | undefined): Date | null {
  const cerrados = (historial ?? [])
    .map((cierre) => cierre.fecha_cierre)
    .filter((fecha): fecha is string => Boolean(fecha))
    .map(parsearFechaBackend)
    .filter((fecha): fecha is Date => fecha !== null)

  if (cerrados.length === 0) return null
  return cerrados.reduce((ultima, fecha) => (fecha > ultima ? fecha : ultima))
}

// la etiqueta dura hasta el primer cierre de caja despues de esa fecha
function antesDelCierre(fecha: string | null, ultimoZ: Date | null): boolean {
  const cuando = parsearFechaBackend(fecha)
  if (!cuando) return false
  return ultimoZ === null || cuando > ultimoZ
}

// producto que creo una factura y todavia no pasa por un cierre Z
export function esProductoNuevo(producto: ProductoInventario, ultimoZ: Date | null): boolean {
  if (producto.origen_creacion !== 'FACTURA') return false
  return antesDelCierre(producto.created_at, ultimoZ)
}

// producto que ya existia y que una factura repuso hace poco
export function esProductoRepuesto(producto: ProductoInventario, ultimoZ: Date | null): boolean {
  if (esProductoNuevo(producto, ultimoZ)) return false
  return antesDelCierre(producto.ultimo_ingreso_factura, ultimoZ)
}

// src/features/proveedores/utils/fichaProveedor.ts
import type { ProductoInventario } from '@/features/inventario/types'
import type { FacturaRegistrada } from '@/features/invoices/types'
import type { OrdenCompra } from '@/features/replenishment/types'
import type { Proveedor } from '@/features/proveedores/types'

// producto de este proveedor que esta bajo su stock minimo
export type ProductoAReponer = {
  nombre: string
  stock_actual: number
  stock_minimo: number
}

// el proveedor + todo lo que sabemos de el cruzando los otros endpoints
export type FichaProveedor = Proveedor & {
  rubros: string[] // categorias reales de los productos que suministra
  ultimaFactura: FacturaRegistrada | null
  totalFacturas: number
  ultimaOrden: OrdenCompra | null
  aReponer: ProductoAReponer[]
}

// el inventario solo trae proveedor_nombre, no proveedor_id: se cruza por nombre
function productosDelProveedor(proveedor: Proveedor, productos: ProductoInventario[]) {
  return productos.filter((producto) => producto.proveedor_nombre === proveedor.nombre_proveedores)
}

// las facturas mas nuevas primero
function ordenarPorFecha<T extends { created_at: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.created_at.localeCompare(a.created_at))
}

// junta proveedores + inventario + facturas + ordenes de compra en una sola ficha por tarjeta
export function armarFichasProveedores(
  proveedores: Proveedor[],
  productos: ProductoInventario[],
  facturas: FacturaRegistrada[],
  ordenes: OrdenCompra[],
): FichaProveedor[] {
  return proveedores.map((proveedor) => {
    const suyos = productosDelProveedor(proveedor, productos)

    const rubros = [...new Set(suyos.map((producto) => producto.categoria).filter((c): c is string => Boolean(c)))]

    const aReponer = suyos
      .filter((producto) => producto.stock_actual < producto.stock_minimo)
      .map((producto) => ({
        nombre: producto.nombre,
        stock_actual: producto.stock_actual,
        stock_minimo: producto.stock_minimo,
      }))

    const suyasFacturas = ordenarPorFecha(facturas.filter((factura) => factura.proveedor_id === proveedor.id))
    const suyasOrdenes = ordenarPorFecha(ordenes.filter((orden) => orden.supplier_id === proveedor.id))

    return {
      ...proveedor,
      rubros,
      ultimaFactura: suyasFacturas[0] ?? null,
      totalFacturas: suyasFacturas.length,
      ultimaOrden: suyasOrdenes[0] ?? null,
      aReponer,
    }
  })
}

// todas las facturas de un proveedor, de la mas nueva a la mas antigua
export function facturasDelProveedor(proveedorId: string, facturas: FacturaRegistrada[]): FacturaRegistrada[] {
  return ordenarPorFecha(facturas.filter((factura) => factura.proveedor_id === proveedorId))
}

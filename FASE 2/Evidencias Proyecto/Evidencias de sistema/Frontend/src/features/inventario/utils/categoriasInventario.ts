// src/features/inventario/utils/categoriasInventario.ts
import type { ProductoInventario } from '@/features/inventario/types'

export const TODAS_CATEGORIAS = 'Todos'

function nombreCategoria(producto: ProductoInventario): string {
  return producto.categoria ?? 'Sin categoria'
}

// categorias presentes en el inventario, con cuantos productos tiene cada una
export function contarCategorias(productos: ProductoInventario[]) {
  const conteo = new Map<string, number>()

  for (const producto of productos) {
    const nombre = nombreCategoria(producto)
    conteo.set(nombre, (conteo.get(nombre) ?? 0) + 1)
  }

  return [
    { nombre: TODAS_CATEGORIAS, cantidad: productos.length },
    ...[...conteo.entries()].map(([nombre, cantidad]) => ({ nombre, cantidad })),
  ]
}

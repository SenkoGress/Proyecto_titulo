// src/features/inventario/utils/categoriasExistentes.ts
import type { ProductoInventario } from '@/features/inventario/types'

// categorias ya usadas en el catalogo, ordenadas y sin repetir. Sirven para ofrecerlas al dar de
// alta: escritas a mano, "Lacteos" y "Lácteos" quedan como dos categorias distintas
export function categoriasExistentes(productos: ProductoInventario[]): string[] {
  const vistas = new Set<string>()

  for (const producto of productos) {
    const nombre = (producto.categoria ?? '').trim()
    if (nombre !== '') vistas.add(nombre)
  }

  return [...vistas].sort((a, b) => a.localeCompare(b, 'es'))
}

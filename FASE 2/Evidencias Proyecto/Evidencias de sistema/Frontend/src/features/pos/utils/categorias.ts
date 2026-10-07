// src/features/pos/utils/categorias.ts
import type { Producto } from '@/features/pos/types'

// color por categoria
const colores: Record<string, string> = {
  Bebidas: '#2563eb',
  Abarrotes: '#ea580c',
  'Lácteos': '#0891b2',
  Lacteos: '#0891b2',
  Snacks: '#7c3aed',
  'Panadería': '#d97706',
  Dulces: '#db2777',
}

// color de una categoria (gris si no esta)
export function colorCategoria(categoria: string): string {
  return colores[categoria] ?? '#475569'
}

// nombre de categoria del producto
export function nombreCategoria(producto: Producto): string {
  return producto.categoria ?? 'Sin categoria'
}

// categorias con su cantidad de productos
export function contarCategorias(productos: Producto[]) {
  const conteo = new Map<string, number>()

  for (const producto of productos) {
    const nombre = nombreCategoria(producto)
    conteo.set(nombre, (conteo.get(nombre) ?? 0) + 1)
  }

  return [...conteo.entries()].map(([nombre, cantidad]) => ({ nombre, cantidad }))
}

// buscar por nombre, sku o codigo de barras
export function coincideBusqueda(producto: Producto, texto: string): boolean {
  const buscado = texto.trim().toLowerCase()
  if (buscado === '') return true

  return (
    producto.nombre.toLowerCase().includes(buscado) ||
    producto.sku.toLowerCase().includes(buscado) ||
    (producto.codigo_barra ?? '').includes(buscado)
  )
}

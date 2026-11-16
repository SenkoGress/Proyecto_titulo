// src/features/pos/hooks/useImagenesProductos.ts
import { useMemo } from 'react'
import { useInventario } from '@/features/inventario/hooks/useInventario'

// la foto no viene en GET /pos/products, que la caja pide seguido: se saca del inventario, que se
// pide una sola vez, y se cruza por id
export function useImagenesProductos(): Map<string, string> {
  const { data: inventario } = useInventario()

  return useMemo(() => {
    const fotos = new Map<string, string>()
    for (const producto of inventario ?? []) {
      if (producto.imagen) fotos.set(producto.id, producto.imagen)
    }
    return fotos
  }, [inventario])
}

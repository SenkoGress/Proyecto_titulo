// src/features/inventario/utils/matrizFefo.ts
import type { NivelRiesgo, ProductoInventario, ProductoVencimiento } from '@/features/inventario/types'

// nivel especial para un producto que no tiene fecha_vencimiento cargada
export type NivelFilaFefo = NivelRiesgo | 'SIN_REGISTRO'

// el producto completo del catalogo (con costo, proveedor, stock minimo...) + su estado fefo
export type FilaFefo = ProductoInventario & {
  dias_restantes: number | null
  nivel: NivelFilaFefo
}

// todo el inventario + su estado fefo (sin fecha queda "sin registro")
export function armarMatrizFefo(
  productos: ProductoInventario[],
  vencimientos: ProductoVencimiento[],
  ordenarPorFefo = true,
): FilaFefo[] {
  const mapaVencimientos = new Map(vencimientos.map((v) => [v.id, v]))

  const filas = productos.map((producto): FilaFefo => {
    const vencimiento = mapaVencimientos.get(producto.id)

    return {
      ...producto,
      lote: vencimiento?.lote ?? producto.lote,
      fecha_vencimiento: vencimiento?.fecha_vencimiento ?? producto.fecha_vencimiento,
      dias_restantes: vencimiento?.dias_restantes ?? null,
      nivel: vencimiento?.nivel_riesgo ?? 'SIN_REGISTRO',
    }
  })

  if (!ordenarPorFefo) return filas

  // orden fefo: el que vence antes va primero; los que no tienen fecha, al final
  return filas.sort((a, b) => {
    if (a.dias_restantes === null) return 1
    if (b.dias_restantes === null) return -1
    return a.dias_restantes - b.dias_restantes
  })
}

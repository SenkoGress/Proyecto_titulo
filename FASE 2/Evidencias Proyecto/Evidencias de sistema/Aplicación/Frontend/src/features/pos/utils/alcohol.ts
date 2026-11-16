// src/features/pos/utils/alcohol.ts
import { esAlcohol } from '@/features/pos/utils/etiquetasProducto'
import type { LineaCarrito } from '@/features/pos/stores/carritoStore'

// ley 19.925: saber si el ticket lleva alcohol
export function tieneAlcohol(lineas: LineaCarrito[]): boolean {
  return lineas.some((linea) => esAlcohol(linea.producto))
}

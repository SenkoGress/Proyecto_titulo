// src/features/replenishment/utils/ordenesPorProveedor.ts
import type { CandidatoProveedor, ItemOrdenSugerida, OrdenSugerida } from '@/features/replenishment/types'

// una linea de la propuesta, ya cruzada con su proveedor
export type LineaPropuesta = {
  item: ItemOrdenSugerida
  orden: OrdenSugerida
}

// aplana las ordenes en lineas, manteniendo juntas las del mismo proveedor
export function lineasDePropuesta(ordenes: OrdenSugerida[]): LineaPropuesta[] {
  return ordenes.flatMap((orden) => orden.items.map((item) => ({ item, orden })))
}

// cuantos proveedores mas venden el mismo producto
export function alternativas(item: ItemOrdenSugerida, proveedorId: string): CandidatoProveedor[] {
  return item.candidatos_proveedores.filter((candidato) => candidato.proveedor_id !== proveedorId)
}

// por que el algoritmo eligio a este proveedor y no a otro
export function motivoEleccion(item: ItemOrdenSugerida, proveedorId: string): string {
  const elegido = item.candidatos_proveedores.find((candidato) => candidato.proveedor_id === proveedorId)

  if (!elegido) return 'Proveedor unico asignado'
  if (elegido.motivo_recomendacion) return elegido.motivo_recomendacion
  if (elegido.es_mejor_precio && elegido.es_visita_mas_proxima) return 'Mejor precio y visita mas proxima'
  if (elegido.es_mejor_precio) return 'Mejor precio'
  if (elegido.es_visita_mas_proxima) return 'Visita mas proxima'

  return 'Proveedor unico asignado'
}

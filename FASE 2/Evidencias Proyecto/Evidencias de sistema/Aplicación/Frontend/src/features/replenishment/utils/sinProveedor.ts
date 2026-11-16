// src/features/replenishment/utils/sinProveedor.ts
import type { OrdenSugerida } from '@/features/replenishment/types'

// el backend agrupa bajo este identificador los productos que no tienen proveedor asignado
export const PROVEEDOR_SIN_ASIGNAR = 'UNASSIGNED'

// esa orden no se graba ni se puede pedir: no hay a quien pedirle
export function esOrdenSinProveedor(orden: Pick<OrdenSugerida, 'proveedor_id'>): boolean {
  return orden.proveedor_id === PROVEEDOR_SIN_ASIGNAR
}

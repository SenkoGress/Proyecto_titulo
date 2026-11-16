// src/features/dashboard/utils/visitasProveedor.ts
import type { Proveedor } from '@/features/proveedores/types'

// proxima visita por proveedor, para cruzarla con los datos del dashboard
export function proximasVisitas(proveedores: Proveedor[]): Record<string, string> {
  const mapa: Record<string, string> = {}

  for (const proveedor of proveedores) {
    mapa[proveedor.id] = proveedor.proxima_visita.displayText
  }

  return mapa
}

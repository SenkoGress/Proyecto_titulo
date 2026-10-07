// src/features/proveedores/types.ts

// proxima visita: la calcula el backend leyendo el texto de dias_visita_proveedores
export type ProximaVisita = {
  daysUntil: number
  nextDate: string
  displayText: string
  matchedDayName: string
}

// proveedor tal como lo devuelve GET /suppliers
export type Proveedor = {
  id: string
  tenant_id: string
  rut_proveedor: string
  nombre_proveedores: string
  giro: string
  direccion: string
  telefono: string
  email: string | null
  dias_visita_proveedores: string
  productos_count: number
  total_productos_suministrados: number
  proxima_visita: ProximaVisita
  created_at: string
  updated_at: string
}

export type RespuestaProveedores = {
  success: boolean
  data: Proveedor[]
  count: number
}

// datos que acepta POST /suppliers (rut y nombre son los unicos obligatorios)
export type NuevoProveedor = {
  rut_proveedor: string
  nombre_proveedores: string
  giro?: string
  direccion?: string
  telefono?: string
  email?: string
  dias_visita_proveedores?: string
}

// PUT /suppliers/:id acepta lo mismo menos el rut
export type EdicionProveedor = Omit<NuevoProveedor, 'rut_proveedor'>

export type RespuestaCrearProveedor = {
  success: boolean
  message: string
  data: { id: string; rut_proveedor: string; nombre_proveedores: string; dias_visita_proveedores: string }
}

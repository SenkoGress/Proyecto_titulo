// src/features/replenishment/types.ts
// segun backend/src/routes/replenishment.routes.ts (formatReplenishmentResponse)

export type ProductoBajoStock = {
  producto_id: string
  sku: string
  codigo_barra: string | null
  nombre: string
  stock_actual: number
  stock_minimo: number
  velocidad_diaria: number
  dias_inventario_restante: number
  reorder_point: number
  is_agotado: boolean
  proveedor_nombre: string | null
  proxima_visita: { displayText: string }
}

// otro proveedor que tambien vende el mismo producto
export type CandidatoProveedor = {
  proveedor_id: string
  proveedor_nombre: string
  rut_proveedor: string
  precio_unitario: number
  dias_visita: string
  proxima_visita: { displayText: string; daysUntil: number }
  es_mejor_precio: boolean
  es_visita_mas_proxima: boolean
  es_recomendado: boolean
  motivo_recomendacion: string | null
}

// linea de una orden sugerida
export type ItemOrdenSugerida = {
  producto_id: string
  sku: string
  codigo_barra: string | null
  producto_nombre: string
  cantidad_sugerida: number
  costo_unitario: number
  costo_estimado: number
  stock_actual: number
  stock_minimo: number
  is_agotado: boolean
  candidatos_proveedores: CandidatoProveedor[]
}

// orden agrupada por proveedor que propone el algoritmo rop
export type OrdenSugerida = {
  orden_id: string
  proveedor_id: string
  proveedor_nombre: string
  proveedor_rut: string
  proveedor_email: string
  proveedor_telefono: string
  dias_visita: string
  proxima_visita: { displayText: string; daysUntil: number }
  estado: string
  total_estimado: number
  items: ItemOrdenSugerida[]
}

export type ResumenReabastecimiento = {
  total_ordenes: number
  total_productos_criticos: number
  costo_total_estimado: number
}

export type RespuestaSugerencia = {
  success: boolean
  data: {
    suggested_orders: OrdenSugerida[]
    low_stock_products: ProductoBajoStock[]
    resumen: ResumenReabastecimiento
  }
}

// parametros del rop que acepta el backend
export type ConfigRop = {
  analysisDays: number
  leadTimeDays: number
  safetyFactor: number
}

// los mismos valores por defecto que tiene el backend
export const CONFIG_ROP_POR_DEFECTO: ConfigRop = {
  analysisDays: 7,
  leadTimeDays: 7,
  safetyFactor: 1.5,
}

// orden de compra ya guardada, de GET /replenishment/purchase-orders
export type OrdenCompra = {
  id: string
  tenant_id: string
  supplier_id: string
  estado: string
  fecha_creacion: string
  total_estimado: number
  created_at: string
  updated_at: string
}

export type RespuestaOrdenesCompra = {
  success: boolean
  orders: OrdenCompra[]
}

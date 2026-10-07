// src/features/inventario/types.ts
// segun backend/src/routes/pos.routes.ts (GET /pos/inventory)

export type ProductoInventario = {
  id: string
  tenant_id: string
  sku: string
  codigo_barra: string | null
  nombre: string
  stock_actual: number
  stock_minimo: number
  precio_compra: number
  precio_venta: number
  categoria: string | null
  activo: number
  updated_at: string
  origen_creacion: string | null // 'FACTURA' si nacio de una factura OCR
  factura_origen_folio: string | null
  lote: string | null
  fecha_vencimiento: string | null
  impuesto_adicional_codigo: number | null
  impuesto_adicional_tasa: number | null
  proveedor_nombre: string | null
}

export type RespuestaInventario = {
  success: boolean
  count: number
  data: ProductoInventario[]
}

// niveles del semaforo sanitario (backend/src/routes/pos.routes.ts, GET /pos/vencimientos)
export type NivelRiesgo = 'ROJO_CRITICO' | 'NARANJA_URGENTE' | 'AMARILLO_ALERTA' | 'AMARILLO_PREVENTIVO' | 'VERDE'
export type EstadoVencimiento = 'VENCIDO' | 'VENCE_ESTA_SEMANA' | 'VENCE_EN_15_DIAS' | 'VENCE_EN_30_DIAS' | 'VIGENTE'

// solo aparecen aca los productos que tienen fecha_vencimiento cargada
export type ProductoVencimiento = {
  id: string
  sku: string
  nombre: string
  stock_actual: number
  precio_compra: number
  precio_venta: number
  lote: string | null
  fecha_vencimiento: string
  dias_restantes: number
  estado: EstadoVencimiento
  nivel_riesgo: NivelRiesgo
}

export type ResumenVencimientos = {
  vencidos: number
  riesgo_critico_7d: number
  riesgo_medio_15d: number
  vence_30_dias: number
  total_con_vencimiento: number
  total_en_riesgo: number
}

export type RespuestaVencimientos = {
  success: boolean
  total: number
  resumen: ResumenVencimientos
  data: ProductoVencimiento[]
}

// alta de producto (POST /pos/products): solo nombre y sku son obligatorios
export type NuevoProducto = {
  nombre: string
  sku: string
  codigo_barra?: string
  precio_compra?: number
  precio_venta?: number
  stock_actual?: number
  stock_minimo?: number
  categoria?: string
  proveedor_id?: string | null
  lote?: string | null
  fecha_vencimiento?: string | null
  impuesto_adicional_codigo?: number
  impuesto_adicional_tasa?: number
}

// edicion (PUT /pos/products/:id): los campos que no se mandan quedan como estaban
export type EdicionProducto = {
  id: string
  cambios: Partial<Omit<NuevoProducto, 'sku' | 'stock_actual'>> & { activo?: boolean }
}

// ajuste de stock (PATCH /pos/products/:id/stock): se manda el conteo, no la diferencia
export type AjusteStock = {
  id: string
  nuevo_stock: number
  motivo?: string
  usuario_id?: string
}

export type RespuestaAjusteStock = {
  success: boolean
  message: string
  data: {
    id: string
    stock_anterior: number
    stock_actual: number
    diferencia: number
  }
}

export type MotivoMerma = 'vencimiento' | 'rotura' | 'robo' | 'deterioro' | 'otro'

export type NuevaMerma = {
  producto_id: string
  cantidad: number
  motivo: MotivoMerma
  observaciones?: string
  usuario_id?: string
}

export type Merma = {
  id: string
  tenant_id: string
  producto_id: string
  cantidad: number
  motivo: string
  observaciones: string | null
  usuario_id: string | null
  fecha: string
  producto_nombre: string | null
  codigo_barra: string | null
  sku: string | null
}

export type RespuestaMermas = {
  success: boolean
  count: number
  data: Merma[]
}

export type TipoMovimiento =
  | 'venta'
  | 'ingreso_factura'
  | 'ajuste'
  | 'alta_inicial'
  | 'ajuste_manual'
  | 'merma'

// una linea del historial (GET /pos/products/:id/history)
export type MovimientoStock = {
  id: string
  tenant_id: string
  producto_id: string
  cambio_anterior: number
  nuevo_stock: number
  cambio: number
  tipo_movimiento: TipoMovimiento
  id_venta_manual: string | null
  motivo: string | null
  fecha_movimiento: string
  usuario_registro: string | null
  producto_nombre: string | null
  sku: string | null
  codigo_barra: string | null
}

export type RespuestaHistorialStock = {
  success: boolean
  count: number
  data: MovimientoStock[]
}

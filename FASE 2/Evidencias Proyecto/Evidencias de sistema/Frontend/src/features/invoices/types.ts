// src/features/invoices/types.ts
// tipos segun backend/src/invoices/invoice-ingestion.service.ts y backend/src/ocr/types.ts

// una linea de la factura ya revisada (respuesta de /invoices/scan)
export type ItemFactura = {
  sku: string
  codigo_barra: string
  descripcion: string
  cantidad: number
  unidad?: string
  precio_unitario: number
  subtotal: number
  precio_venta_sugerido: number
  es_nuevo: boolean
  stock_actual: number
  stock_proyectado: number
}

// lo que espera POST /invoices/confirm (ExtractedInvoiceData del backend)
export type ItemExtraido = {
  sku?: string | null
  descripcion: string
  cantidad: number
  precio_unitario: number
  subtotal: number
  unidad?: string
}

export type DatosExtraidosFactura = {
  folio_factura: string
  rut_proveedor: string
  razon_social: string
  giro_proveedor?: string
  direccion_proveedor?: string
  telefono_proveedor?: string
  dias_visita_proveedor?: string
  fecha_emision: string // formato YYYY-MM-DD
  items: ItemExtraido[]
  total: number
  metodo_ingreso: string
  metadata?: Record<string, unknown>
}

// respuesta completa de POST /invoices/scan (no toca la base de datos)
export type PrevisualizacionFactura = {
  folio_factura: string
  rut_proveedor: string
  razon_social: string
  giro_proveedor?: string
  direccion_proveedor?: string
  telefono_proveedor?: string
  dias_visita_proveedor?: string
  es_proveedor_nuevo?: boolean
  fecha_emision: string
  monto_neto: number
  iva_credito: number
  total_factura: number
  items_count: number
  ocr_provider: string
  margin_used: number
  items: ItemFactura[]
  raw_data: DatosExtraidosFactura
}

// respuesta de POST /invoices/confirm
export type ResultadoIngesta = {
  invoice_id: string
  folio_factura: string
  proveedor_id: string
  rut_proveedor: string
  total: number
  items_count: number
  used_fallback: boolean
  ocr_provider: string
  duration_ms: number
}

// factura ya guardada, de GET /invoices
export type FacturaRegistrada = {
  id: string
  tenant_id: string
  proveedor_id: string
  proveedor_nombre: string | null
  numero_factura: string
  rut_proveedor: string
  fecha_ingreso: string
  estado: string
  cantidad: number
  metodo_ingreso: string
  monto_neto: number
  iva_credito: number
  total_factura: number
  created_at: string
}

export type RespuestaFacturas = {
  success: boolean
  invoices: FacturaRegistrada[]
}

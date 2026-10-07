// src/features/pos/types.ts
// tipos segun backend/src/routes/pos.routes.ts

// producto (GET /pos/products)
export type Producto = {
  id: string
  tenant_id: string
  sku: string
  codigo_barra: string | null
  nombre: string
  stock_actual: number
  stock_minimo: number
  precio_venta: number
  categoria: string | null
  activo: number
  lote: string | null
  fecha_vencimiento: string | null
  impuesto_adicional_codigo: number | null // ila: 26, 27, 28
  impuesto_adicional_tasa: number | null
}

export type RespuestaProductos = {
  success: boolean
  count: number
  data: Producto[]
}

// estado del terminal (GET /pos/status)
export type EstadoPos = {
  success: boolean
  status: 'ONLINE' | 'SYNC_PENDING' | 'OFFLINE'
  cloud_online: boolean
  pending_dirty_count: number
  last_synced_at: string | null
  device_id: string
  tenant_id: string
}

// pasarelas de la tabla metodos_pago
export type MetodoPago = 'EFECTIVO' | 'TRANSBANK' | 'MERCADOPAGO' | 'SUMUP' | 'RUTPAY'

// boleta (39) o factura (33) electronica
export type TipoComprobante = 'BOLETA' | 'FACTURA'

// datos que exige el SII para emitir una factura
export type ReceptorEmpresa = {
  rut: string
  razon_social: string
  giro: string
  direccion: string
  comuna: string
  ciudad: string
}

// item que se envia al checkout
export type ItemCheckout = {
  producto_id: string
  cantidad: number
  precio_unitario: number
  nombre: string
  sku: string
  codigo_ila?: number
}

// body de POST /pos/checkout
export type PeticionCheckout = {
  tenant_id: string
  usuario_id: string
  items: ItemCheckout[]
  metodo_pago: MetodoPago
  tipo_comprobante: TipoComprobante
  rut_cliente?: string
  receptor_empresa?: ReceptorEmpresa
}

// resultado tributario: con tarjeta puede ser voucher en vez de boleta
export type DteEmitido = {
  tipoDocumento: string
  esTributarioDte: boolean
  mensajeLegal: string
  fecha: string
  dteId?: string
  folio?: number
  tipoDte?: number
  qrUrl?: string
  tedXml?: string
  totales?: {
    neto: number
    iva: number
    exento: number
    total: number
    desgloseIla?: { codigo: number; nombre: string; tasa: number; monto: number }[]
  }
}

// venta guardada (respuesta 201)
export type VentaRegistrada = {
  saleId: string
  folio: string
  total: number
  unidades: number
  dte: DteEmitido | null
  contiene_alcohol: boolean
  payment_method: string
  payment_status: string
  payment_transaction_id: string | null
  is_dirty: number
  sync_status: string
  latency_ms: number
}

export type RespuestaCheckout = {
  success: boolean
  data: VentaRegistrada
}

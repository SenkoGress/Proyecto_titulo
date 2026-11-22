// src/features/ventas/types.ts
// segun backend/src/routes/pos.routes.ts (GET /pos/transactions y POST /pos/devolucion)

export type ItemTransaccion = {
  id: string
  cantidad: number
  precio_unitario: number
  subtotal: number
  producto_id: string
  producto_nombre: string
  sku: string
  codigo_barra: string | null
}

// una venta o una devolucion: el backend las guarda en la misma tabla
export type Transaccion = {
  id: string
  folio: string
  fecha: string
  total: number
  unidades: number
  estado: string
  sync_status: string
  sync_attempts: number
  // 1 cuando agoto los intentos: no vuelve a subir sola, hay que reintentarla a mano
  sync_detenida: number
  observaciones: string | null
  cajero_nombre: string
  medio_pago_nombre: string
  medio_pago_tipo: string
  es_devolucion: number
  referencia_venta_id: string | null
  rut_cliente: string | null
  tipo_documento_tributario: string | null
  // credito o debito; null en efectivo, en RutPay y en las ventas anteriores a la 1.0.6
  tipo_tarjeta: string | null
  // como se devolvio la plata, en las filas que son devolucion
  medio_devolucion: string | null
  monto_ila: number
  items: ItemTransaccion[]
}

export type RespuestaTransacciones = {
  success: boolean
  count: number
  data: Transaccion[]
}

// dte emitido (GET /dte/list), para cruzarlo con la venta
export type DteEmitido = {
  id: string
  tipo_dte: number
  folio: number
  fecha_emision: string
  rut_emisor: string
  razon_social_emisor: string
  rut_receptor: string | null
  monto_neto: number
  monto_iva: number
  monto_total: number
  estado_sii: string
  qr_code_content: string | null
  venta_id: string | null
}

export type RespuestaDtes = {
  success: boolean
  data: DteEmitido[]
}

// lo que se devuelve de una venta (si va vacio, el backend devuelve todo)
export type ItemDevolucion = {
  producto_id: string
  cantidad: number
}

// como se le devolvio la plata al cliente
export type MedioDevolucion = 'TARJETA' | 'EFECTIVO' | 'TRANSFERENCIA'

export type RespuestaDevolucion = {
  success: boolean
  message: string
  data: {
    devolucion_id: string
    folio_nc: number
    monto_total: number
    total_devuelto: number
    // lo que registro el servidor; null en una devolucion anterior a la 1.0.6
    medio_devolucion: MedioDevolucion | null
    // lo que se le entrega al cliente: redondeado si fue en efectivo. total_devuelto es el monto
    // de la nota de credito, que va exacto
    devuelto_al_cliente: number
    // el proveedor no permite devolver el pago desde la caja: la nota de credito se emite igual
    reverso_tarjeta: { pasarela: string; monto: number; manual: boolean } | null
  }
}

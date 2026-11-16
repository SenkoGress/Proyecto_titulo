// src/features/dte/types.ts

// datos tributarios del local (backend/src/dte/dte-emitter.service.ts)
export type EmisorFiscal = {
  rut: string
  razonSocial: string
  giro: string
  acteco: string
  direccion: string
  comuna: string
  ciudad: string
  telefono: string
  correoEmisor: string
}

// modelo_b: con tarjeta el voucher reemplaza la boleta (Res. Ex. N° 176)
export type ModeloEmision = 'MODELO_A' | 'MODELO_B'

// lo que el backend declara sobre el manejo de datos de tarjeta
export type CumplimientoPci = {
  active: boolean
  panStorage: string
  cvvStorage: string
  pinStorage: string
  maskedDisplayOnly: boolean
  standard: string
}

export type ConfigDte = {
  modeloEmision: ModeloEmision
  emisor: EmisorFiscal
  pciDssCompliance?: CumplimientoPci
}

// respuesta de GET /api/v1/dte/config
export type RespuestaConfigDte = {
  success: boolean
  data: ConfigDte
}

// lo que acepta POST /api/v1/dte/config (todos los campos son opcionales)
export type EdicionConfigDte = {
  modeloEmision?: ModeloEmision
  rut?: string
  razonSocial?: string
  giro?: string
  acteco?: string
  direccion?: string
  comuna?: string
  ciudad?: string
  telefono?: string
  correoEmisor?: string
}

// comprobante para el cliente (GET /dte/:id/receipt)
export type ItemComprobante = {
  cantidad: number
  precio_unitario: number
  subtotal: number
  nombre: string
  sku: string
}

export type ComprobanteDte = {
  dteId: string
  tipoDte: number
  nombreDocumento: string
  folio: number
  fechaEmision: string
  emisor: { rut: string; razonSocial: string }
  receptor: { rut: string | null; razonSocial: string | null }
  totales: { neto: number; iva: number; exento: number; total: number }
  items: ItemComprobante[]
  qrCodeUrl: string
  tedXml: string
  leyendaFiscal: string
}

export type RespuestaComprobante = {
  success: boolean
  data: ComprobanteDte
}

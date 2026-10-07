// src/features/sii/types.ts
// segun backend/src/routes/dte.routes.ts y backend/src/dte/*

// stock de folios autorizados (GET /dte/caf/status)
export type EstadoCaf = {
  tipoDte: number
  nombreDte: string
  folioDesde: number
  folioHasta: number
  ultimoUsado: number
  foliosDisponibles: number
  porcentajeDisponible: number
  fechaAutorizacion: string
  activo: boolean
}

// una linea del debito o del credito fiscal (GET /dte/f29)
export type ItemF29 = {
  tipoDocumento: string
  tipoDte?: number
  cantidad: number
  montoNeto: number
  montoIva: number
  montoTotal: number
}

export type ReporteF29 = {
  periodo: string
  tenantId: string
  debitoFiscal: {
    items: ItemF29[]
    totalNeto: number
    totalIvaDebito: number
    totalIla: number
    totalBruto: number
  }
  creditoFiscal: {
    items: ItemF29[]
    totalNeto: number
    totalIvaCredito: number
    totalBruto: number
  }
  balance: {
    ivaDeterminadoAPagar: number
    remanenteCreditoFiscal: number
    tasaPpm: number
    montoPpm: number
    totalImpuestoPagarF29: number
  }
}

// consumo diario de folios de boleta (GET /dte/rcof/list)
export type RegistroRcof = {
  id: string
  fecha_reporte: string
  secuencia_envio: number
  cantidad_boletas: number
  total_neto: number
  total_iva: number
  total_ventas: number
  estado_envio: string
  created_at: string
}

// lo que devuelve POST /dte/rcof/generate
export type RcofGenerado = {
  fechaReporte: string
  secuencia: number
  cantidadBoletas: number
  montoNeto: number
  montoIva: number
  montoExento: number
  montoTotal: number
  folioInicial: number
  folioFinal: number
  xmlRcof: string
}

// guia de despacho emitida (GET /dte/guias)
export type GuiaDespacho = {
  id: string
  folio: number
  fecha_emision: string
  tipo_traslado: number
  receptor_rut: string
  receptor_razon_social: string
  direccion_destino: string
  comuna_destino: string
  chofer_rut: string | null
  chofer_nombre: string | null
  patente_vehiculo: string | null
  total_items: number
  monto_total: number
  estado: string
}

// lo que se manda a POST /dte/guias/emitir
export type ItemGuia = {
  nombre: string
  sku: string
  cantidad: number
  precioUnitario: number
}

export type NuevaGuia = {
  receptorRut: string
  receptorRazonSocial: string
  direccionDestino: string
  comunaDestino: string
  tipoTraslado: number
  patente?: string
  choferRut?: string
  choferNombre?: string
  items: ItemGuia[]
}

// set de prueba del SII (POST /dte/certification/run-set)
export type CasoCertificacion = {
  suiteName: string
  passed: boolean
  tipoDte: number
  foliosGenerados: number[]
  detalles: string
  timestamp: string
}

export type ResultadoCertificacion = {
  success: boolean
  ambiente: string
  urlSii: string
  resultados: CasoCertificacion[]
  resumen: string
}

// respaldo legal completo (GET /dte/backup/export)
export type RespaldoLegal = {
  sistema: string
  leyenda_legal: string
  timestamp_exportacion: string
  tenant_id: string
  totales_registros: {
    dtes_emitidos: number
    facturas_compra_respaldadas: number
    folios_caf_autorizados: number
    transacciones_venta: number
    cierres_caja: number
    guias_despacho: number
  }
  datos: Record<string, unknown>
}

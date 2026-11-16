// src/shared/utils/etiquetasEstado.ts

// el backend guarda estos codigos en ingles y en mayusculas: son nombres de columna, no texto
// para el dueño del local. Aca se traducen a algo leible, y el codigo crudo queda en `codigo`
// para mostrarlo en el tooltip del modo tecnico.

export type Tono = 'default' | 'success' | 'warning' | 'error' | 'info'

export type Etiqueta = {
  texto: string
  tono: Tono
  codigo: string
}

// un codigo que no esta en la tabla se muestra tal cual: es preferible a esconderlo
function traducir(mapa: Record<string, [string, Tono]>, codigo: string | null | undefined): Etiqueta {
  const crudo = (codigo ?? '').trim()
  if (!crudo) return { texto: 'Sin estado', tono: 'default', codigo: '' }

  const encontrado = mapa[crudo.toUpperCase()]
  if (!encontrado) return { texto: crudo, tono: 'default', codigo: crudo }

  return { texto: encontrado[0], tono: encontrado[1], codigo: crudo }
}

// factura_ingresos.estado. PROCESSED y PROCESADA son el mismo estado escrito de dos formas:
// la ingesta local guarda una y la de la nube la otra
const ESTADO_FACTURA: Record<string, [string, Tono]> = {
  PROCESSED: ['Procesada', 'success'],
  PROCESADA: ['Procesada', 'success'],
  PENDIENTE_OCR: ['En cola', 'warning'],
  FALLIDA_OCR: ['Fallo la lectura', 'error'],
}

export function etiquetaEstadoFactura(codigo: string | null | undefined): Etiqueta {
  return traducir(ESTADO_FACTURA, codigo)
}

// factura_ingresos.metodo_ingreso: con que se leyo la factura
const METODO_INGRESO: Record<string, [string, Tono]> = {
  OCR_GEMINI_AI: ['Leida por IA', 'success'],
  OCR_PDF_DTE_PARSER: ['Leida del PDF', 'success'],
  OCR_FRONERI_RECOGNIZER: ['Formato Froneri', 'success'],
  CONFIRMED_SCAN: ['Revisada a mano', 'info'],
  OCR_MOCK_PARSER: ['Lectura de prueba', 'warning'],
  OCR_MOCK_FALLBACK: ['Lectura de prueba', 'warning'],
}

export function etiquetaMetodoIngreso(codigo: string | null | undefined): Etiqueta {
  return traducir(METODO_INGRESO, codigo)
}

// sii_dte_emitidos.estado_sii
const ESTADO_SII: Record<string, [string, Tono]> = {
  EMITIDO_LOCAL: ['Emitido en el local', 'info'],
  ENVIADO: ['Enviado al SII', 'warning'],
  ENVIADO_SII: ['Enviado al SII', 'warning'],
  ACEPTADO_SII: ['Aceptado por el SII', 'success'],
  RECHAZADO: ['Rechazado por el SII', 'error'],
  RECHAZADO_SII: ['Rechazado por el SII', 'error'],
  PENDIENTE: ['Pendiente', 'default'],
}

export function etiquetaEstadoSii(codigo: string | null | undefined): Etiqueta {
  return traducir(ESTADO_SII, codigo)
}

// guias_despacho.estado
const ESTADO_GUIA: Record<string, [string, Tono]> = {
  EMITIDA: ['Emitida', 'success'],
  ANULADA: ['Anulada', 'error'],
}

export function etiquetaEstadoGuia(codigo: string | null | undefined): Etiqueta {
  return traducir(ESTADO_GUIA, codigo)
}

// transacciones_venta.tipo_documento_tributario. VOUCHER_TRANSBANK es la etiqueta que el backend
// usa para cualquier tarjeta, no solo para Transbank
const DOCUMENTO_VENTA: Record<string, [string, Tono]> = {
  BOLETA_ELECTRONICA: ['Boleta electronica', 'success'],
  FACTURA: ['Factura electronica', 'success'],
  NOTA_CREDITO: ['Nota de credito', 'warning'],
  VOUCHER_TRANSBANK: ['Comprobante de pago con tarjeta', 'info'],
}

export function etiquetaDocumentoVenta(codigo: string | null | undefined): Etiqueta {
  return traducir(DOCUMENTO_VENTA, codigo)
}

// configuracion sii_ambiente: maullin y palena son los dos servidores del SII
const AMBIENTE_SII: Record<string, [string, Tono]> = {
  CERTIFICACION_MAULLIN: ['Ambiente de certificacion', 'warning'],
  PRODUCCION_PALENA: ['Ambiente de produccion', 'success'],
}

export function etiquetaAmbienteSii(codigo: string | null | undefined): Etiqueta {
  return traducir(AMBIENTE_SII, codigo)
}

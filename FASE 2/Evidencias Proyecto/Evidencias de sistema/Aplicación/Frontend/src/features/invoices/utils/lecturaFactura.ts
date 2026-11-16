// src/features/invoices/utils/lecturaFactura.ts
import type { PrevisualizacionFactura } from '@/features/invoices/types'

// el ocr responde bien pero sin nada util cuando la imagen no se entiende
export function noSePudoLeer(preview: PrevisualizacionFactura): boolean {
  return (preview.items?.length ?? 0) === 0
}

// se leyeron productos pero falta el folio, que es el numero de la factura
export function faltaElFolio(preview: PrevisualizacionFactura): boolean {
  if (noSePudoLeer(preview)) return false
  return !preview.folio_factura
}

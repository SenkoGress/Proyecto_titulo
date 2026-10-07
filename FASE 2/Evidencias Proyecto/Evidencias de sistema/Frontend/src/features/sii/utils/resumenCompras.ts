// src/features/sii/utils/resumenCompras.ts
import type { FacturaRegistrada } from '@/features/invoices/types'

export type ResumenCompras = {
  cantidad: number
  neto: number
  ivaCredito: number
  bruto: number
}

// totales de las facturas de compra respaldadas
export function resumirCompras(facturas: FacturaRegistrada[]): ResumenCompras {
  return {
    cantidad: facturas.length,
    neto: facturas.reduce((suma, factura) => suma + factura.monto_neto, 0),
    ivaCredito: facturas.reduce((suma, factura) => suma + factura.iva_credito, 0),
    bruto: facturas.reduce((suma, factura) => suma + factura.total_factura, 0),
  }
}

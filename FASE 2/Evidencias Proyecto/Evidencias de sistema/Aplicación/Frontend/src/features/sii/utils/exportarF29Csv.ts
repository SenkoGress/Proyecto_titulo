// src/features/sii/utils/exportarF29Csv.ts
import type { ReporteF29 } from '@/features/sii/types'

// el f29 del periodo en csv, listo para pasarle al contador
export function exportarF29Csv(reporte: ReporteF29) {
  const filas: (string | number)[][] = [
    ['Formulario 29 (pre-liquidacion)', reporte.periodo],
    [],
    ['DEBITO FISCAL (ventas)'],
    ['Documento', 'Cantidad', 'Neto', 'IVA', 'Total'],
    ...reporte.debitoFiscal.items.map((item) => [
      item.tipoDocumento,
      item.cantidad,
      item.montoNeto,
      item.montoIva,
      item.montoTotal,
    ]),
    ['Total debito', '', reporte.debitoFiscal.totalNeto, reporte.debitoFiscal.totalIvaDebito, reporte.debitoFiscal.totalBruto],
    ['Impuesto adicional ILA', '', '', '', reporte.debitoFiscal.totalIla],
    [],
    ['CREDITO FISCAL (compras)'],
    ['Documento', 'Cantidad', 'Neto', 'IVA', 'Total'],
    ...reporte.creditoFiscal.items.map((item) => [
      item.tipoDocumento,
      item.cantidad,
      item.montoNeto,
      item.montoIva,
      item.montoTotal,
    ]),
    ['Total credito', '', reporte.creditoFiscal.totalNeto, reporte.creditoFiscal.totalIvaCredito, reporte.creditoFiscal.totalBruto],
    [],
    ['BALANCE'],
    ['IVA determinado a pagar', reporte.balance.ivaDeterminadoAPagar],
    ['Remanente credito fiscal', reporte.balance.remanenteCreditoFiscal],
    ['Tasa PPM %', reporte.balance.tasaPpm],
    ['Monto PPM', reporte.balance.montoPpm],
    ['Total a pagar en el F29', reporte.balance.totalImpuestoPagarF29],
  ]

  const csv = filas
    .map((fila) => fila.map((valor) => `"${String(valor).replace(/"/g, '""')}"`).join(';'))
    .join('\n')

  // agregamos BOM para que Excel reconozca los acentos
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = `f29_${reporte.periodo}_gestock.csv`
  enlace.click()

  URL.revokeObjectURL(url)
}

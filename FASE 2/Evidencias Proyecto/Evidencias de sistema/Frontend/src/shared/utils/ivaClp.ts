// src/shared/utils/ivaClp.ts

// separa un monto bruto en neto + iva 19%
export function desglosarIvaClp(totalBruto: number) {
  const total = Math.round(totalBruto)
  const neto = Math.round(total / 1.19)
  const iva = total - neto
  return { neto, iva, total }
}

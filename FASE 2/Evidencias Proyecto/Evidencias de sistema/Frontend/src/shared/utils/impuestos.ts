// src/shared/utils/impuestos.ts
import { aplicarRedondeoChileno } from '@/shared/utils/redondeoChileno'

// iva chile
const TASA_IVA = 0.19

export type LineaImpuesto = {
  subtotal: number // precio bruto (con iva e ila)
  tasaIla: number // 0 si no tiene ila
}

export type Desglose = {
  neto: number
  iva: number
  ila: number
  bruto: number
  redondeo: number
  total: number
}

// separar neto, iva e ila (el redondeo solo aplica a efectivo)
export function desglosarImpuestos(lineas: LineaImpuesto[], aplicaRedondeo = true): Desglose {
  let neto = 0
  let iva = 0
  let ila = 0
  let bruto = 0

  for (const linea of lineas) {
    const subtotal = Math.round(linea.subtotal)
    const netoLinea = Math.round(subtotal / (1 + TASA_IVA + linea.tasaIla / 100))

    neto += netoLinea
    iva += Math.round(netoLinea * TASA_IVA)
    ila += Math.round(netoLinea * (linea.tasaIla / 100))
    bruto += subtotal
  }

  // total con ley de redondeo (solo efectivo)
  const total = aplicaRedondeo ? aplicarRedondeoChileno(bruto) : bruto

  return { neto, iva, ila, bruto, redondeo: total - bruto, total }
}

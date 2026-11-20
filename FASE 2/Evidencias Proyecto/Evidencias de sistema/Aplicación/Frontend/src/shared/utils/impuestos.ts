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

// separar neto, iva e ila (el redondeo solo aplica a efectivo). misma regla que el documento
// tributario (backend/src/dte/dte-emitter.service.ts): el neto de lo que no lleva ila se saca una
// vez sobre el total y el iva es lo que falta, asi la pantalla muestra lo mismo que la boleta
export function desglosarImpuestos(lineas: LineaImpuesto[], aplicaRedondeo = true): Desglose {
  let netoConIla = 0
  let ila = 0
  let brutoSinIla = 0
  let bruto = 0

  for (const linea of lineas) {
    const subtotal = Math.round(linea.subtotal)
    bruto += subtotal
    if (linea.tasaIla <= 0) {
      brutoSinIla += subtotal
      continue
    }
    const netoLinea = Math.round(subtotal / (1 + TASA_IVA + linea.tasaIla / 100))
    netoConIla += netoLinea
    ila += Math.round(netoLinea * (linea.tasaIla / 100))
  }

  const neto = Math.round(brutoSinIla / (1 + TASA_IVA)) + netoConIla
  const iva = bruto - neto - ila

  // total con ley de redondeo (solo efectivo)
  const total = aplicaRedondeo ? aplicarRedondeoChileno(bruto) : bruto

  return { neto, iva, ila, bruto, redondeo: total - bruto, total }
}

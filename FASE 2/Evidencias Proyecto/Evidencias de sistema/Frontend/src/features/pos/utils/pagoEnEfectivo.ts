// src/features/pos/utils/pagoEnEfectivo.ts
import { DENOMINACIONES } from '@/features/caja/utils/denominaciones'

// el cliente pasa un punado de billetes y monedas, no un monto redondo: cada denominacion suma
export const BILLETES_Y_MONEDAS = DENOMINACIONES.map((d) => d.valor)

export type EstadoVuelto = {
  vuelto: number
  falta: number
  alcanza: boolean
}

// cuanto falta o cuanto hay que devolver
export function calcularVuelto(recibido: number, total: number): EstadoVuelto {
  const diferencia = recibido - total
  return {
    vuelto: diferencia > 0 ? diferencia : 0,
    falta: diferencia < 0 ? -diferencia : 0,
    alcanza: diferencia >= 0,
  }
}

// con que billetes y monedas conviene devolver, de mayor a menor
export function desglosarVuelto(vuelto: number): { valor: number; cantidad: number }[] {
  let resto = Math.max(0, Math.round(vuelto))
  const piezas: { valor: number; cantidad: number }[] = []

  for (const valor of BILLETES_Y_MONEDAS) {
    const cantidad = Math.floor(resto / valor)
    if (cantidad > 0) {
      piezas.push({ valor, cantidad })
      resto -= cantidad * valor
    }
  }

  return piezas
}

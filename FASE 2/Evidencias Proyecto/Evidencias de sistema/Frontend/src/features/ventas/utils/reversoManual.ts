// src/features/ventas/utils/reversoManual.ts
import { formatoClp } from '@/shared/utils/formatoClp'
import type { RespuestaDevolucion } from '@/features/ventas/types'

type Reverso = RespuestaDevolucion['data']['reverso_tarjeta']

// RutPay, una devolucion parcial de Transbank y el debito que el terminal se niega a anular dejan
// el reverso pendiente: la nota de credito sale igual y la plata la devuelve el cajero
export function hayQueDevolverAMano(reverso: Reverso): boolean {
  return Boolean(reverso?.manual)
}

export function avisoReversoManual(reverso: Reverso): string | null {
  if (!hayQueDevolverAMano(reverso) || !reverso) return null
  return `Entregale ${formatoClp(Math.abs(reverso.monto))} en efectivo o por transferencia: el pago con ${reverso.pasarela} no se pudo devolver desde la caja.`
}

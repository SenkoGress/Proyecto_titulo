// src/features/pos/utils/tipoTarjeta.ts
import type { MetodoPago, TipoTarjeta } from '@/features/pos/types'

// RutPay aprueba desde el telefono del cliente y el efectivo no tiene tarjeta: en esos dos el
// servidor ignora el tipo y lo guarda nulo
const SIN_TARJETA: MetodoPago[] = ['EFECTIVO', 'RUTPAY']

export function esConTarjeta(metodoPago: MetodoPago): boolean {
  return !SIN_TARJETA.includes(metodoPago)
}

// lo que viaja en el cobro. Sin tarjeta no se manda nada, para no mandar un dato que el servidor
// va a descartar
export function tipoTarjetaParaCobro(
  metodoPago: MetodoPago,
  tipoTarjeta: TipoTarjeta | null,
): TipoTarjeta | undefined {
  if (!esConTarjeta(metodoPago) || !tipoTarjeta) return undefined
  return tipoTarjeta
}

export function nombreTipoTarjeta(tipo: string | null | undefined): string | null {
  if (tipo === 'CREDITO') return 'Credito'
  if (tipo === 'DEBITO') return 'Debito'
  return null
}

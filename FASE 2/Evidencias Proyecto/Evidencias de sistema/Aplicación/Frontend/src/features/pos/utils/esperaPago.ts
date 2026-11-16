// src/features/pos/utils/esperaPago.ts
import type { MetodoPago } from '@/features/pos/types'

// que es lo que el cajero tiene que ir a mirar en cada pasarela
const MAQUINA: Partial<Record<MetodoPago, string>> = {
  TRANSBANK: 'El terminal Transbank',
  MERCADOPAGO: 'La maquina Mercado Pago Point',
  SUMUP: 'El lector SumUp',
  RUTPAY: 'La aplicacion RutPay del cliente',
}

export type AccionEnMaquina = 'COBRO' | 'DEVOLUCION'

export function esperaEnMaquina(metodoPago: string): boolean {
  return metodoPago !== 'EFECTIVO'
}

// la maquina tarda lo que tarde el cliente en pasar la tarjeta, y el servidor espera dos o dos y
// medio minutos segun la pasarela. Sin decir donde esta pasando, el cajero solo ve un boton cargando y no sabe si se colgo
export function avisoEspera(metodoPago: string, segundos: number, accion: AccionEnMaquina = 'COBRO'): string {
  const maquina = MAQUINA[metodoPago as MetodoPago] ?? 'La maquina'

  const base =
    accion === 'DEVOLUCION'
      ? `${maquina} esta devolviendo el dinero a la tarjeta. No cierres esta ventana.`
      : `${maquina} esta esperando la tarjeta. Pidele al cliente que la pase.`

  if (segundos < 20) return base
  if (segundos < 60) return `${base} Van ${segundos} segundos.`
  return `${base} Van ${segundos} segundos: la caja espera un par de minutos antes de darla por rechazada.`
}

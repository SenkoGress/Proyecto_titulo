// src/features/pos/utils/modoPagos.ts
import type { ModoPagos } from '@/features/pos/types'

type Aviso = { texto: string; detalle: string; tono: 'error' | 'warning' }

// en simulado la caja aprueba la tarjeta sin cobrarle a nadie, y el cajero no tiene como saberlo:
// el boton se ve igual, el voucher se imprime igual y la venta queda pagada
const AVISOS: Record<ModoPagos, Aviso | null> = {
  simulado: {
    texto: 'TARJETA DE PRUEBA',
    detalle: 'La caja aprueba cualquier tarjeta sin cobrar. Para cobrar de verdad hay que configurar la maquina en pagos.json.',
    tono: 'error',
  },
  sandbox: {
    texto: 'TARJETA EN SANDBOX',
    detalle: 'La caja cobra contra la cuenta de prueba del proveedor. No se mueve dinero real.',
    tono: 'warning',
  },
  produccion: null,
}

export function avisoModoPagos(modo?: ModoPagos): Aviso | null {
  return modo ? AVISOS[modo] : null
}

// la misma advertencia impresa, para que el papel no parezca un comprobante de pago de verdad
export function leyendaVoucher(modo?: ModoPagos): string | null {
  if (!modo || modo === 'produccion') return null
  return modo === 'simulado'
    ? '*** PAGO SIMULADO: NO SE COBRO ***'
    : '*** PAGO DE PRUEBA (SANDBOX) ***'
}

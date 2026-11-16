// src/features/pos/utils/metodosVisibles.ts
import { METODOS_PAGO } from '@/features/pos/metodosPago'
import type { MetodoPago } from '@/features/pos/types'

type Opcion = (typeof METODOS_PAGO)[number]

// RutPay solo aprueba sin salir del equipo: BancoEstado no publica una API de cobro para cajas,
// asi que no se ofrece a menos que el local la configure a proposito
const SIN_CONFIGURAR: MetodoPago[] = ['RUTPAY']

// el almacen tiene una maquina, no cuatro. El servidor dice cuales estan configuradas en
// pagos.json; mientras no lo diga se muestran todas, para no esconder la que el local usa
export function metodosVisibles(configuradas?: MetodoPago[]): Opcion[] {
  const permitidas = configuradas?.length
    ? new Set<MetodoPago>(['EFECTIVO', ...configuradas])
    : null

  const visibles = METODOS_PAGO.filter((metodo) =>
    permitidas ? permitidas.has(metodo.valor) : !SIN_CONFIGURAR.includes(metodo.valor)
  )

  // con una sola maquina el cajero no elige marca, elige entre efectivo y tarjeta
  const conTarjeta = visibles.filter((metodo) => metodo.valor !== 'EFECTIVO')
  if (conTarjeta.length !== 1) return visibles

  return visibles.map((metodo) => (metodo.valor === conTarjeta[0].valor ? { ...metodo, etiqueta: 'Tarjeta' } : metodo))
}

// si el metodo elegido deja de estar visible, la venta se quedaria apuntando a una maquina oculta
export function metodoElegible(metodoPago: MetodoPago, visibles: Opcion[]): MetodoPago {
  return visibles.some((metodo) => metodo.valor === metodoPago) ? metodoPago : 'EFECTIVO'
}

// src/features/ventas/utils/etiquetaMedioPago.ts
import { nombreTipoTarjeta } from '@/features/pos/utils/tipoTarjeta'
import { nombreMedio } from '@/features/ventas/utils/medioDevolucion'
import type { MedioDevolucion } from '@/features/ventas/types'

type Fila = {
  medio_pago_nombre: string
  medio_pago_tipo: string
  tipo_tarjeta: string | null
  medio_devolucion: string | null
  es_devolucion: number
}

// "Transbank · Debito" cuando se sabe el tipo. En efectivo y en las ventas anteriores a la 1.0.6
// queda como estaba, sin inventar un tipo que nadie registro
export function etiquetaMedioPago(fila: Fila): string {
  const tipo = nombreTipoTarjeta(fila.tipo_tarjeta)
  return tipo ? `${fila.medio_pago_nombre} · ${tipo}` : fila.medio_pago_nombre
}

// lo que se ve al pasar el mouse: la pasarela y, en una devolucion, por donde salio la plata
export function detalleMedioPago(fila: Fila): string {
  const partes = [`Pasarela: ${fila.medio_pago_tipo}`]
  const tipo = nombreTipoTarjeta(fila.tipo_tarjeta)
  if (tipo) partes.push(`Tarjeta: ${tipo}`)
  if (fila.es_devolucion === 1) {
    partes.push(`Devuelto ${nombreMedio(fila.medio_devolucion as MedioDevolucion | null)}`)
  }
  return partes.join(' · ')
}

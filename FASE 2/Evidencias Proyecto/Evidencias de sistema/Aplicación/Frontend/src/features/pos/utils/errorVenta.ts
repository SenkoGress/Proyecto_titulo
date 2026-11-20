// src/features/pos/utils/errorVenta.ts
import { isAxiosError } from 'axios'

type ProductoSinStock = { producto_id: string; nombre: string; disponible: number; pedida: number }

type CuerpoError = {
  error?: string
  message?: string
  productos?: ProductoSinStock[]
}

function cuerpo(error: unknown): CuerpoError | null {
  if (!isAxiosError(error) || !error.response) return null
  return (error.response.data as CuerpoError) ?? null
}

export function codigoVenta(error: unknown): string | null {
  return cuerpo(error)?.error ?? null
}

// la caja esta cerrada: el cajero no tiene por que saber donde se abre el turno
export function esTurnoCerrado(error: unknown): boolean {
  return codigoVenta(error) === 'TURNO_CERRADO'
}

// la tarjeta quedo cobrada y la venta no se guardo. Cobrar de nuevo le cobra dos veces al cliente
export function cobroSinVenta(error: unknown): boolean {
  return codigoVenta(error) === 'COBRO_SIN_VENTA'
}

// el rut del emisor va en cada boleta y solo el administrador puede corregirlo en Configuracion
export function emisorSinRutValido(error: unknown): boolean {
  return codigoVenta(error) === 'EMISOR_RUT_INVALIDO'
}

// que producto falta y cuanto, para corregir la linea sin ir a buscarlo al mensaje
export function productosSinStock(error: unknown): ProductoSinStock[] {
  if (codigoVenta(error) !== 'STOCK_INSUFICIENTE') return []
  return cuerpo(error)?.productos ?? []
}

export function faltaStock(producto: ProductoSinStock): string {
  const quedan = Math.max(0, producto.disponible)
  const resto = quedan === 0 ? 'no queda ninguno' : `quedan ${quedan}`
  return `${producto.nombre}: se piden ${producto.pedida} y ${resto}`
}

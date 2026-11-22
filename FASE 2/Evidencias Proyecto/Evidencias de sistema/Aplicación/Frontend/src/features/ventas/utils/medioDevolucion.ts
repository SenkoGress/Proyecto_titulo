// src/features/ventas/utils/medioDevolucion.ts
import { isAxiosError } from 'axios'
import type { MedioDevolucion } from '@/features/ventas/types'

type Opcion = { valor: MedioDevolucion; etiqueta: string; ayuda: string }

const EN_LA_MAQUINA: Opcion = {
  valor: 'TARJETA',
  etiqueta: 'En la maquina',
  ayuda: 'Se anula el pago en el terminal. No sale plata de la gaveta.',
}

const EN_EFECTIVO: Opcion = {
  valor: 'EFECTIVO',
  etiqueta: 'En efectivo',
  ayuda: 'Sale de la gaveta y descuadra el turno si no se registra. Necesita el turno abierto.',
}

const POR_TRANSFERENCIA: Opcion = {
  valor: 'TRANSFERENCIA',
  etiqueta: 'Por transferencia',
  ayuda: 'No toca la maquina ni la gaveta. Tambien sirve si se devolvio desde el portal de la pasarela.',
}

// una venta en efectivo solo se devuelve en efectivo: el servidor rechaza los otros dos
export function mediosPosibles(medioPagoTipo: string): Opcion[] {
  if (medioPagoTipo === 'EFECTIVO') return [EN_EFECTIVO]
  return [EN_LA_MAQUINA, EN_EFECTIVO, POR_TRANSFERENCIA]
}

// la maquina primero cuando la venta fue con tarjeta: es lo que deja la caja cuadrada sola
export function medioPorDefecto(medioPagoTipo: string): MedioDevolucion {
  return medioPagoTipo === 'EFECTIVO' ? 'EFECTIVO' : 'TARJETA'
}

function codigo(error: unknown): string | null {
  if (!isAxiosError(error) || !error.response) return null
  return (error.response.data as { error?: string } | undefined)?.error ?? null
}

// el terminal no pudo anular el pago y el servidor no registro nada: hay que elegir como se
// devuelve y volver a enviar
export function esReversoManual(error: unknown): boolean {
  return codigo(error) === 'REVERSO_MANUAL'
}

// ya hay una devolucion de esta misma venta en curso
export function esDevolucionEnCurso(error: unknown): boolean {
  return codigo(error) === 'DEVOLUCION_EN_CURSO'
}

// cuando el reverso falla, la plata la entrega el cajero: por caja o transferido
export function mediosSinMaquina(): Opcion[] {
  return [EN_EFECTIVO, POR_TRANSFERENCIA]
}

export function nombreMedio(medio: MedioDevolucion | null): string {
  if (medio === 'TARJETA') return 'anulado en la maquina'
  if (medio === 'EFECTIVO') return 'en efectivo, de la gaveta'
  if (medio === 'TRANSFERENCIA') return 'por transferencia'
  return 'sin registrar como se devolvio'
}

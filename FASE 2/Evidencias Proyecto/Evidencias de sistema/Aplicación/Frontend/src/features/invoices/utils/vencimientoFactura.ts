// src/features/invoices/utils/vencimientoFactura.ts
import type { AvisoVencimiento, ItemFactura } from '@/features/invoices/types'

type ConVencimiento = Pick<ItemFactura, 'descripcion' | 'cantidad' | 'fecha_vencimiento' | 'no_vence'>

// misma regla que backend/src/inventory/vencimiento.ts: solo AAAA-MM-DD de calendario real.
// el motor de lectura puede traer la fecha en otro formato, y esa no cuenta como declarada
export function esFechaDeVencimientoValida(fecha: string | null | undefined): fecha is string {
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false
  const [anio, mes, dia] = fecha.split('-').map(Number)
  const real = new Date(anio, mes - 1, dia)
  return real.getFullYear() === anio && real.getMonth() === mes - 1 && real.getDate() === dia
}

// cada producto necesita su fecha o la marca de que no vence
export function faltaVencimiento(item: Pick<ItemFactura, 'fecha_vencimiento' | 'no_vence'>): boolean {
  return !item.no_vence && !esFechaDeVencimientoValida(item.fecha_vencimiento)
}

// negativo si ya vencio, cero si vence hoy; en dias de calendario del equipo
export function diasParaVencer(fecha: string, hoy: Date): number {
  const [anio, mes, dia] = fecha.split('-').map(Number)
  const inicioDeHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  return Math.round((new Date(anio, mes - 1, dia).getTime() - inicioDeHoy.getTime()) / 86_400_000)
}

// vencido es anterior a hoy: lo que vence hoy todavia se puede vender
export function productosVencidos(items: ConVencimiento[], hoy: Date): AvisoVencimiento[] {
  const vencidos: AvisoVencimiento[] = []

  for (const item of items) {
    if (item.no_vence || !esFechaDeVencimientoValida(item.fecha_vencimiento)) continue
    const dias = diasParaVencer(item.fecha_vencimiento, hoy)
    if (dias < 0) {
      vencidos.push({
        descripcion: item.descripcion,
        fecha_vencimiento: item.fecha_vencimiento,
        cantidad: item.cantidad,
        dias_restantes: dias,
      })
    }
  }

  return vencidos
}

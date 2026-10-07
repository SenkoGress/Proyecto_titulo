// src/features/ventas/utils/filtrosVentas.ts
import { parsearFechaBackend } from '@/shared/utils/fechaBackend'
import type { FilaVenta } from '@/features/ventas/utils/filaVenta'

export type TipoMovimiento = 'todos' | 'ventas' | 'devoluciones'
export type RangoFecha = 'todo' | 'hoy' | 'semana' | 'mes'

const DIAS: Record<Exclude<RangoFecha, 'todo'>, number> = { hoy: 1, semana: 7, mes: 30 }

function dentroDelRango(venta: FilaVenta, rango: RangoFecha): boolean {
  if (rango === 'todo') return true

  const fecha = parsearFechaBackend(venta.fecha)
  if (!fecha) return false

  const desde = new Date()
  desde.setHours(0, 0, 0, 0)
  desde.setDate(desde.getDate() - (DIAS[rango] - 1))

  return fecha >= desde
}

// busca por folio, cajero, medio de pago o nombre de producto
function coincideTexto(venta: FilaVenta, busqueda: string): boolean {
  const texto = busqueda.trim().toLowerCase()
  if (texto === '') return true

  return (
    venta.folio.toLowerCase().includes(texto) ||
    venta.cajero_nombre.toLowerCase().includes(texto) ||
    venta.medio_pago_nombre.toLowerCase().includes(texto) ||
    venta.items.some((item) => item.producto_nombre.toLowerCase().includes(texto) || item.sku.toLowerCase().includes(texto))
  )
}

export function filtrarVentas(
  ventas: FilaVenta[],
  busqueda: string,
  tipo: TipoMovimiento,
  rango: RangoFecha,
): FilaVenta[] {
  return ventas.filter((venta) => {
    const coincideTipo =
      tipo === 'todos' || (tipo === 'devoluciones' ? venta.esDevolucion : !venta.esDevolucion)

    return coincideTipo && dentroDelRango(venta, rango) && coincideTexto(venta, busqueda)
  })
}

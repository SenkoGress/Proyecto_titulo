// src/features/caja/types.ts
// tipos segun backend/src/caja/cierre-caja.service.ts

export type TipoMovimiento = 'INGRESO' | 'EGRESO'

export type MovimientoCaja = {
  id: string
  tenant_id: string
  sesion_caja_id: string
  tipo: TipoMovimiento
  monto: number
  motivo: string
  usuario_id?: string
  created_at: string
}

// turno de caja (abierto o cerrado)
export type SesionCaja = {
  id: string
  tenant_id: string
  usuario_id: string
  cajero_nombre?: string
  fecha_apertura: string
  fecha_cierre?: string | null
  monto_apertura: number
  ventas_efectivo: number
  ventas_transbank: number
  ventas_mercadopago: number
  ventas_sumup: number
  ventas_rutpay: number
  monto_ila?: number
  total_ila?: number
  total_ingresos_caja: number
  total_egresos_caja: number
  total_ventas: number
  monto_esperado_efectivo: number
  monto_real_efectivo?: number | null
  diferencia_efectivo?: number | null
  estado: 'ABIERTA' | 'CERRADA'
  observaciones?: string | null
  transacciones_count?: number
  movimientos?: MovimientoCaja[]
}

// respuesta de GET /caja/resumen (activa=false si no hay turno abierto)
export type RespuestaResumenCaja = {
  success: boolean
  activa: boolean
  data: SesionCaja | null
}

// cierre del historial: trae ademas el estado de sincronizacion
export type CierreHistorial = SesionCaja & {
  is_dirty: number
  sync_status: string
  created_at: string
}

export type RespuestaHistorialCaja = {
  success: boolean
  data: CierreHistorial[]
}

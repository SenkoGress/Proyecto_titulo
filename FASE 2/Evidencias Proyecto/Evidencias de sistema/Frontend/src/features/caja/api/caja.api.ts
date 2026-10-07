// src/features/caja/api/caja.api.ts
import { httpClient } from '@/lib/api/httpClient'
import { endpoints } from '@/lib/api/endpoints'
import { env } from '@/config/env'
import type { RespuestaHistorialCaja, RespuestaResumenCaja, SesionCaja, TipoMovimiento} from '@/features/caja/types'

// estado en vivo del turno actual (o null si no hay ninguno abierto)
export async function obtenerResumenCaja() {
  const { data } = await httpClient.get<RespuestaResumenCaja>(endpoints.caja.resumen)
  return data
}

// abrir turno con el fondo inicial de la gaveta
export async function abrirCaja(montoApertura: number) {
  const { data } = await httpClient.post<{ success: boolean; data: SesionCaja }>(endpoints.caja.abrir, {
    tenant_id: env.tenantId,
    usuario_id: env.usuarioId,
    monto_apertura: montoApertura,
  })
  return data.data
}

// arqueo y cierre: genera el balance del turno
export async function cerrarCaja(montoRealEfectivo: number, observaciones?: string) {
  const { data } = await httpClient.post<{ success: boolean; data: SesionCaja }>(endpoints.caja.cerrar, {
    tenant_id: env.tenantId,
    usuario_id: env.usuarioId,
    monto_real_efectivo: montoRealEfectivo,
    observaciones,
  })
  return data.data
}

// registrar un ingreso o egreso manual de efectivo
export async function registrarMovimiento(tipo: TipoMovimiento, monto: number, motivo: string) {
  const { data } = await httpClient.post(endpoints.caja.movimiento, {
    tenant_id: env.tenantId,
    usuario_id: env.usuarioId,
    tipo,
    monto,
    motivo,
  })
  return data.data
}

// historial de cierres del local
export async function obtenerHistorialCaja() {
  const { data } = await httpClient.get<RespuestaHistorialCaja>(endpoints.caja.historial)
  return data.data
}

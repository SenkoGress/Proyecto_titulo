// src/features/caja/api/caja.api.ts
import { httpClient } from '@/lib/api/httpClient'
import { endpoints } from '@/lib/api/endpoints'
import type {
  RespuestaCorreccion,
  RespuestaCorrecciones,
  RespuestaHistorialCaja,
  RespuestaResumenCaja,
  SesionCaja,
  TipoMovimiento,
} from '@/features/caja/types'
import { tenantActual, usuarioActualId } from '@/features/auth/utils/identidad'

// estado en vivo del turno actual (o null si no hay ninguno abierto)
export async function obtenerResumenCaja() {
  const { data } = await httpClient.get<RespuestaResumenCaja>(endpoints.caja.resumen)
  return data
}

// abrir turno con el fondo inicial de la gaveta
export async function abrirCaja(montoApertura: number) {
  const { data } = await httpClient.post<{ success: boolean; data: SesionCaja }>(endpoints.caja.abrir, {
    tenant_id: tenantActual(),
    usuario_id: usuarioActualId(),
    monto_apertura: montoApertura,
  })
  return data.data
}

// arqueo y cierre: genera el balance del turno
export async function cerrarCaja(montoRealEfectivo: number, observaciones?: string) {
  const { data } = await httpClient.post<{ success: boolean; data: SesionCaja }>(endpoints.caja.cerrar, {
    tenant_id: tenantActual(),
    usuario_id: usuarioActualId(),
    monto_real_efectivo: montoRealEfectivo,
    observaciones,
  })
  return data.data
}

// registrar un ingreso o egreso manual de efectivo
export async function registrarMovimiento(tipo: TipoMovimiento, monto: number, motivo: string) {
  const { data } = await httpClient.post(endpoints.caja.movimiento, {
    tenant_id: tenantActual(),
    usuario_id: usuarioActualId(),
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

// corregir el conteo de un cierre ya cerrado. Solo el administrador; el servidor reemplaza el
// usuario por el de la sesion, asi que el autor es siempre quien corrige
export async function corregirCierre(variables: {
  cierreId: string
  montoRealEfectivo: number
  motivo: string
}) {
  const { data } = await httpClient.post<RespuestaCorreccion>(endpoints.caja.correccion(variables.cierreId), {
    tenant_id: tenantActual(),
    usuario_id: usuarioActualId(),
    monto_real_efectivo: variables.montoRealEfectivo,
    motivo: variables.motivo,
  })
  return data.data
}

// el rastro completo de un cierre, en orden
export async function obtenerCorreccionesCierre(cierreId: string) {
  const { data } = await httpClient.get<RespuestaCorrecciones>(endpoints.caja.correcciones(cierreId), {
    params: { tenant_id: tenantActual() },
  })
  return data.data
}

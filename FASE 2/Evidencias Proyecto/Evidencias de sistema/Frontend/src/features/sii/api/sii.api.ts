// src/features/sii/api/sii.api.ts
import { httpClient } from '@/lib/api/httpClient'
import { endpoints } from '@/lib/api/endpoints'
import { env } from '@/config/env'
import type {
  EstadoCaf,
  GuiaDespacho,
  NuevaGuia,
  RcofGenerado,
  RegistroRcof,
  ReporteF29,
  RespaldoLegal,
  ResultadoCertificacion,
} from '@/features/sii/types'

// todas las rutas de dte leen "tenantId", no tenant_id
const params = { tenantId: env.tenantId }

// folios autorizados por el sii y cuantos quedan
export async function obtenerFoliosCaf() {
  const { data } = await httpClient.get<{ data: EstadoCaf[] }>(endpoints.dte.caf, { params })
  return data.data
}

// pre-liquidacion del formulario 29 del mes
export async function obtenerF29(periodo: string, tasaPpm: number) {
  const { data } = await httpClient.get<{ data: ReporteF29 }>(endpoints.dte.f29, {
    params: { ...params, periodo, tasaPpm },
  })
  return data.data
}

// reportes de consumo de folios ya generados
export async function obtenerRcof() {
  const { data } = await httpClient.get<{ data: RegistroRcof[] }>(endpoints.dte.rcofLista, { params })
  return data.data
}

// genera el consumo de folios de un dia
export async function generarRcof(fechaReporte: string) {
  const { data } = await httpClient.post<{ data: RcofGenerado }>(endpoints.dte.rcofGenerar, {
    tenantId: env.tenantId,
    fechaReporte,
  })
  return data.data
}

// guias de despacho emitidas
export async function obtenerGuias() {
  const { data } = await httpClient.get<{ data: GuiaDespacho[] }>(endpoints.dte.guias, { params })
  return data.data
}

export async function emitirGuia(guia: NuevaGuia) {
  const { data } = await httpClient.post<{ message: string; data: { folio: number } }>(
    endpoints.dte.guiasEmitir,
    { tenantId: env.tenantId, ...guia },
  )
  return data
}

// set de prueba tecnico del sii: emite documentos de verdad
export async function correrCertificacion() {
  const { data } = await httpClient.post<{ data: ResultadoCertificacion }>(endpoints.dte.certificacion, {
    tenantId: env.tenantId,
  })
  return data.data
}

// respaldo completo de los 6 anios que exige el codigo tributario
export async function obtenerRespaldoLegal() {
  const { data } = await httpClient.get<RespaldoLegal>(endpoints.dte.respaldo, { params })
  return data
}

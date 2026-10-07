// src/features/invoices/api/invoices.api.ts
import { httpClient } from '@/lib/api/httpClient'
import { endpoints } from '@/lib/api/endpoints'
import { env } from '@/config/env'
import type {
  DatosExtraidosFactura,
  PrevisualizacionFactura,
  RespuestaFacturas,
  ResultadoIngesta,
} from '@/features/invoices/types'

// leer una factura con gemini toma cerca de 20 segundos, mas que el resto de llamadas
const ESPERA_OCR_MS = 60_000

// paso 1: escanear con ocr, no modifica la base de datos
export async function escanearFactura(archivoBase64: string, nombreArchivo: string, tipoArchivo: string) {
  const { data } = await httpClient.post<{ success: boolean; preview: PrevisualizacionFactura }>(
    endpoints.invoices.scan,
    {
      tenant_id: env.tenantId,
      invoice_data: archivoBase64,
      file_name: nombreArchivo,
      mime_type: tipoArchivo,
    },
    { timeout: ESPERA_OCR_MS },
  )
  return data.preview
}

// paso 2: confirmar e ingresar la mercaderia al inventario
export async function confirmarFactura(datos: DatosExtraidosFactura) {
  const { data } = await httpClient.post<{ success: boolean; data: ResultadoIngesta }>(
    endpoints.invoices.confirm,
    { tenant_id: env.tenantId, invoice_data: datos },
  )
  return data.data
}

// historial de facturas ya confirmadas
export async function obtenerFacturas() {
  const { data } = await httpClient.get<RespuestaFacturas>(endpoints.invoices.listar)
  return data.invoices
}

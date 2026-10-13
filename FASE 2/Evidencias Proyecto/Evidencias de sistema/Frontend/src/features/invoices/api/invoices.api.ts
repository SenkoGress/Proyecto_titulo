// src/features/invoices/api/invoices.api.ts
import { httpClient } from '@/lib/api/httpClient'
import { endpoints } from '@/lib/api/endpoints'
import { tenantActual } from '@/features/auth/utils/identidad'
import type {
  DatosExtraidosFactura,
  DocumentoFactura,
  FacturaEnCola,
  ResultadoEscaneo,
  PrevisualizacionFactura,
  RespuestaFacturas,
  ResultadoIngesta,
} from '@/features/invoices/types'

// leer una factura con gemini toma cerca de 20 segundos, mas que el resto de llamadas
const ESPERA_OCR_MS = 60_000

// paso 1: escanear con ocr, no modifica la base de datos.
// si ningun motor logra leerla el backend responde 202 y la deja en cola
export async function escanearFactura(
  archivoBase64: string,
  nombreArchivo: string,
  tipoArchivo: string,
): Promise<ResultadoEscaneo> {
  const { data } = await httpClient.post<{
    success: boolean
    preview?: PrevisualizacionFactura
    encolada?: boolean
    data?: FacturaEnCola
    message?: string
  }>(
    endpoints.invoices.scan,
    {
      tenant_id: tenantActual(),
      invoice_data: archivoBase64,
      file_name: nombreArchivo,
      mime_type: tipoArchivo,
    },
    { timeout: ESPERA_OCR_MS },
  )

  if (data.encolada && data.data) {
    return {
      tipo: 'encolada',
      cola: data.data,
      mensaje: data.message ?? 'No fue posible digitalizar el documento ahora.',
    }
  }

  return { tipo: 'leida', preview: data.preview as PrevisualizacionFactura }
}

// paso 2: confirmar e ingresar la mercaderia al inventario.
// el documento vuelve tal cual: sin el, la factura queda sin respaldo para el contador
export async function confirmarFactura(variables: {
  datos: DatosExtraidosFactura
  documento?: DocumentoFactura
}) {
  const { data } = await httpClient.post<{ success: boolean; data: ResultadoIngesta }>(
    endpoints.invoices.confirm,
    {
      tenant_id: tenantActual(),
      invoice_data: variables.datos,
      documento: variables.documento,
    },
  )
  return data.data
}

// historial de facturas ya confirmadas
export async function obtenerFacturas() {
  const { data } = await httpClient.get<RespuestaFacturas>(endpoints.invoices.listar)
  return data.invoices
}

// facturas que esperan en la cola, incluidas las que ya se rindieron
export async function obtenerPendientes() {
  const { data } = await httpClient.get<{
    success: boolean
    count: number
    intentos_maximos: number
    data: FacturaEnCola[]
  }>(endpoints.invoices.pendientes)
  return data
}

// reintentar ahora, sin esperar al boton de sincronizar
export async function procesarPendientes() {
  const { data } = await httpClient.post<{
    success: boolean
    data: { procesadas: number; fallidas: number; pendientes: number }
  }>(endpoints.invoices.procesarPendientes, { tenant_id: tenantActual() })
  return data.data
}

// el archivo original: llega como bytes, no como json
export async function abrirDocumentoFactura(facturaId: string, nombre: string) {
  const { data } = await httpClient
    .get<Blob>(endpoints.invoices.documento(facturaId), { responseType: 'blob' })
    .catch(async (problema) => {
      // el error si viene en json, pero dentro de un blob porque asi se pidio
      const cuerpo = problema?.response?.data
      if (cuerpo instanceof Blob) {
        const texto = await cuerpo.text()
        throw new Error(JSON.parse(texto).message ?? texto)
      }
      throw problema
    })

  const url = URL.createObjectURL(data)
  const ventana = window.open(url, '_blank')

  // si el navegador bloquea la pestana, se descarga
  if (!ventana) {
    const enlace = document.createElement('a')
    enlace.href = url
    enlace.download = nombre
    enlace.click()
  }

  // el navegador ya tiene el archivo cargado
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

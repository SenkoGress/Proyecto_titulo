// casos/07-facturas-ocr.mjs
import { obtener, enviar } from '../lib/cliente.mjs'

export const nombre = 'Facturas: lectura con OCR'

// un texto que imita una factura, para no depender de un archivo
const FACTURA = Buffer.from(
  [
    'DISTRIBUIDORA DE PRUEBA LIMITADA',
    'GIRO: DISTRIBUCION DE ABARROTES',
    'R.U.T.: 76.111.222-3',
    'FACTURA ELECTRONICA',
    'N 50001',
    'FECHA EMISION 01.10.2026',
    'TOTAL 11900',
  ].join('\n'),
).toString('base64')

export async function ejecutar(b) {
  const escaneo = await enviar('/api/v1/invoices/scan', {
    invoice_data: FACTURA,
    file_name: 'factura-de-prueba.txt',
    mime_type: 'text/plain',
  })
  b.estado('POST /invoices/scan lee la factura', escaneo, 200)

  const vista = escaneo.datos?.preview
  if (!vista) {
    b.omitir('revisar lo que extrajo', 'el escaneo no devolvio vista previa')
    return
  }

  b.comprobar('informa que motor la leyo', Boolean(vista.ocr_provider), vista.ocr_provider)

  // el simulador inventa una factura completa: si aparece, la pantalla muestra datos que no existen
  b.comprobar(
    'NO usa el simulador que inventa datos',
    vista.ocr_provider !== 'MockOcrFallback',
    vista.ocr_provider === 'MockOcrFallback' ? 'cuidado: estos datos son ficticios' : '',
  )

  b.comprobar('extrae el folio', Boolean(vista.folio_factura), String(vista.folio_factura))
  b.comprobar('extrae el proveedor', Boolean(vista.razon_social), String(vista.razon_social))
  b.comprobar('calcula el neto y el iva', vista.monto_neto !== undefined && vista.iva_credito !== undefined)
  b.comprobar('informa el margen con que sugiere los precios', vista.margin_used !== undefined, `${vista.margin_used}%`)

  // el escaneo es solo lectura: no debe tocar la base
  const inventarioAntes = await contarProductos()
  await enviar('/api/v1/invoices/scan', {
    invoice_data: FACTURA,
    file_name: 'factura-de-prueba.txt',
    mime_type: 'text/plain',
  })
  const inventarioDespues = await contarProductos()
  b.igual('escanear NO modifica el inventario', inventarioDespues, inventarioAntes)

  const historial = await obtener('/api/v1/invoices/')
  b.comprobar('GET /invoices/ lista las facturas ingresadas', historial.estado === 200, `estado ${historial.estado}`)

  b.omitir(
    'confirmar la ingesta',
    'crearia productos de verdad en el inventario, se prueba a mano desde la pantalla',
  )
}

async function contarProductos() {
  const respuesta = await obtener('/api/v1/pos/inventory')
  return (respuesta.datos?.data ?? []).length
}

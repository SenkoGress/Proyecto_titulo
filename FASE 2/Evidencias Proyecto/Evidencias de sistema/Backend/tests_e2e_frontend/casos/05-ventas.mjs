// casos/05-ventas.mjs
import { obtener } from '../lib/cliente.mjs'

export const nombre = 'Ventas: historial, devoluciones y documentos'

export async function ejecutar(b) {
  const ventas = await obtener('/api/v1/pos/transactions?limit=100')
  b.estado('GET /pos/transactions responde', ventas, 200)

  const filas = ventas.datos?.data ?? []
  b.comprobar('trae ventas registradas', filas.length > 0, `${filas.length} ventas`)
  if (filas.length === 0) return

  const v = filas[0]

  // estos campos los necesita el historial de ventas del frontend
  const campos = [
    'id', 'folio', 'fecha', 'total', 'unidades', 'estado', 'sync_status',
    'cajero_nombre', 'medio_pago_nombre', 'es_devolucion', 'referencia_venta_id',
    'rut_cliente', 'tipo_documento_tributario', 'monto_ila', 'items',
  ]
  const faltantes = campos.filter((c) => v[c] === undefined)
  b.comprobar('cada venta trae los campos que usa la pantalla', faltantes.length === 0, faltantes.join(', '))

  if (v.items?.length > 0) {
    const item = v.items[0]
    b.comprobar(
      'los items traen producto_id, no solo el sku',
      Boolean(item.producto_id),
      'sin esto la devolucion parcial no se puede armar',
    )
    b.comprobar('los items traen el codigo de barra', 'codigo_barra' in item)
  }

  // las devoluciones se reconocen por el campo, no por el nombre del folio
  const devoluciones = filas.filter((f) => f.es_devolucion === 1)
  if (devoluciones.length > 0) {
    const d = devoluciones[0]
    b.comprobar('la devolucion viene marcada con es_devolucion', d.es_devolucion === 1)
    b.comprobar('la devolucion apunta a la venta que anula', Boolean(d.referencia_venta_id))
    b.comprobar('la devolucion tiene total negativo', Number(d.total) < 0, `total ${d.total}`)

    const original = filas.find((f) => f.id === d.referencia_venta_id)
    b.comprobar(
      'la venta anulada esta en la misma lista',
      Boolean(original),
      original ? `anula ${original.folio}` : 'fuera del rango consultado',
    )
  } else {
    b.omitir('revisar una devolucion', 'no hay devoluciones registradas')
  }

  const dtes = await obtener(`/api/v1/dte/list?tenantId=${''}`)
  b.comprobar(
    'GET /dte/list responde',
    dtes.estado === 200,
    `estado ${dtes.estado}, ${dtes.ms} ms`,
  )

  const emitidos = dtes.datos?.data ?? []
  if (emitidos.length > 0) {
    const doc = emitidos[0]
    b.comprobar('cada documento trae su folio y su tipo', Boolean(doc.folio) && doc.tipo_dte !== undefined)
  } else {
    b.omitir('revisar un documento emitido', 'no hay documentos emitidos')
  }
}

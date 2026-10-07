// src/features/ventas/utils/exportarVentasCsv.ts
import { formatFecha } from '@/shared/utils/formatFecha'
import { nombreDocumentoDte } from '@/features/dte/utils/nombreDte'
import { detalleProductos } from '@/features/ventas/utils/filaVenta'
import type { FilaVenta } from '@/features/ventas/utils/filaVenta'

// descarga lo que esta filtrado en pantalla
export function exportarVentasCsv(ventas: FilaVenta[]) {
  const encabezado = [
    'Folio',
    'Fecha',
    'Tipo',
    'Cajero',
    'Medio de pago',
    'Unidades',
    'Total',
    'Estado',
    'Sincronizacion',
    'Documento',
    'Folio DTE',
    'Productos',
  ]

  const filas = ventas.map((venta) => [
    venta.folio,
    formatFecha(venta.fecha),
    venta.esDevolucion ? 'Devolucion' : 'Venta',
    venta.cajero_nombre,
    venta.medio_pago_nombre,
    venta.unidades,
    venta.total,
    venta.estado,
    venta.sync_status,
    venta.dte ? nombreDocumentoDte(venta.dte.tipo_dte) : 'Sin documento',
    venta.dte?.folio ?? '',
    detalleProductos(venta),
  ])

  const csv = [encabezado, ...filas]
    .map((fila) => fila.map((valor) => `"${String(valor).replace(/"/g, '""')}"`).join(';'))
    .join('\n')

  // agregamos BOM para que Excel reconozca los acentos
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = `ventas_gestock_${new Date().toISOString().slice(0, 10)}.csv`
  enlace.click()

  URL.revokeObjectURL(url)
}

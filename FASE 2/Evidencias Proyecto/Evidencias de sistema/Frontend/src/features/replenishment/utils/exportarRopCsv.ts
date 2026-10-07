// src/features/dashboard/utils/exportarRopCsv.ts
import type { FilaRop } from '@/features/replenishment/utils/detalleRop'

const COLUMNAS = [
  'Severidad',
  'SKU',
  'Producto',
  'Codigo de barra',
  'Stock actual',
  'Stock minimo',
  'Demanda diaria',
  'Dias de inventario restante',
  'Punto de reorden',
  'Deficit',
  'Cantidad sugerida',
  'Costo estimado',
  'Proveedor',
  'Proxima visita',
]

function celda(valor: string | number): string {
  return `"${String(valor).replace(/"/g, '""')}"`
}

// informe de reposicion en csv (100% frontend, no hay endpoint de exportacion)
export function exportarRopCsv(filas: FilaRop[]) {
  const cuerpo = filas.map((fila) =>
    [
      fila.severidad,
      fila.sku,
      fila.nombre,
      fila.codigo_barra ?? '',
      fila.stock_actual,
      fila.stock_minimo,
      fila.velocidad_diaria,
      fila.dias_inventario_restante,
      fila.reorder_point,
      fila.deficit,
      fila.cantidadSugerida,
      fila.costoEstimado,
      fila.proveedor_nombre ?? '',
      fila.proxima_visita.displayText,
    ]
      .map(celda)
      .join(','),
  )

  const contenido = [COLUMNAS.map(celda).join(','), ...cuerpo].join('\n')

  // el BOM hace que excel en espanol abra bien los acentos
  const blob = new Blob(['﻿' + contenido], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = `reposicion-rop-${new Date().toISOString().slice(0, 10)}.csv`
  enlace.click()

  URL.revokeObjectURL(url)
}

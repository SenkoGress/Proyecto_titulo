// src/features/inventario/utils/exportarMermasCsv.ts
import type { Merma } from '@/features/inventario/types'

// descarga el registro de bajas, sirve como respaldo sanitario
export function exportarMermasCsv(mermas: Merma[]) {
  const encabezado = ['Fecha', 'SKU', 'Producto', 'Cantidad', 'Motivo', 'Detalle', 'Registrado por']

  const filas = mermas.map((m) => [
    m.fecha,
    m.sku ?? '',
    m.producto_nombre ?? '',
    m.cantidad,
    m.motivo,
    m.observaciones ?? '',
    m.usuario_id ?? '',
  ])

  const csv = [encabezado, ...filas]
    .map((fila) => fila.map((valor) => `"${String(valor).replace(/"/g, '""')}"`).join(';'))
    .join('\n')

  // agregamos BOM para que Excel reconozca los acentos
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = `mermas-${new Date().toISOString().slice(0, 10)}.csv`
  enlace.click()
  URL.revokeObjectURL(url)
}

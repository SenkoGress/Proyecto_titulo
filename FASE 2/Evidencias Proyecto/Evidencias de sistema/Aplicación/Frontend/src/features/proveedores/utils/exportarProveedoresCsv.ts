// src/features/proveedores/utils/exportarProveedoresCsv.ts
import type { FichaProveedor } from '@/features/proveedores/utils/fichaProveedor'

const COLUMNAS = [
  'RUT',
  'Razon social',
  'Giro',
  'Direccion',
  'Telefono',
  'Correo',
  'Dias visita',
  'Proxima visita',
  'Rubros',
  'Productos que surte',
  'Productos bajo minimo',
  'Ultima factura',
  'Total ultima factura',
]

// escapa comillas y envuelve, para que las comas del texto no rompan el csv
function celda(valor: string | number): string {
  return `"${String(valor).replace(/"/g, '""')}"`
}

// descarga el directorio como csv (100% frontend, no hay endpoint de exportacion)
export function exportarProveedoresCsv(fichas: FichaProveedor[]) {
  const filas = fichas.map((ficha) =>
    [
      ficha.rut_proveedor,
      ficha.nombre_proveedores,
      ficha.giro,
      ficha.direccion,
      ficha.telefono,
      ficha.email ?? '',
      ficha.dias_visita_proveedores,
      ficha.proxima_visita.displayText,
      ficha.rubros.join(' / '),
      ficha.total_productos_suministrados,
      ficha.aReponer.length,
      ficha.ultimaFactura?.numero_factura ?? '',
      ficha.ultimaFactura?.total_factura ?? '',
    ]
      .map(celda)
      .join(','),
  )

  const contenido = [COLUMNAS.map(celda).join(','), ...filas].join('\n')

  // el BOM hace que excel en espanol abra bien los acentos
  const blob = new Blob(['﻿' + contenido], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = `proveedores-${new Date().toISOString().slice(0, 10)}.csv`
  enlace.click()

  URL.revokeObjectURL(url)
}

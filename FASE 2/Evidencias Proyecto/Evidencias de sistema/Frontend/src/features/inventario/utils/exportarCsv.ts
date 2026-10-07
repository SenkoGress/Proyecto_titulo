// src/features/inventario/utils/exportarCsv.ts
import type { ProductoInventario } from '@/features/inventario/types'

// descarga en csv lo que esta filtrado en pantalla
export function exportarInventarioCsv(productos: ProductoInventario[]) {
  const encabezado = ['SKU', 'Codigo de barra', 'Producto', 'Categoria', 'Proveedor', 'Stock', 'Stock minimo', 'Costo', 'Venta', 'Margen %']

  const filas = productos.map((p) => [
    p.sku,
    p.codigo_barra ?? '',
    p.nombre,
    p.categoria ?? 'Sin categoria',
    p.proveedor_nombre ?? '',
    p.stock_actual,
    p.stock_minimo,
    p.precio_compra,
    p.precio_venta,
    p.precio_venta > 0 ? (((p.precio_venta - p.precio_compra) / p.precio_venta) * 100).toFixed(1) : '0',
  ])

  const csv = [encabezado, ...filas]
    .map((fila) => fila.map((valor) => `"${String(valor).replace(/"/g, '""')}"`).join(';'))
    .join('\n')

  // agregamos BOM para que Excel reconozca los acentos
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = `inventario_gestock_${new Date().toISOString().slice(0, 10)}.csv`
  enlace.click()

  URL.revokeObjectURL(url)
}

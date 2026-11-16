// src/features/inventario/utils/calculosInventario.ts
import type { ProductoInventario } from '@/features/inventario/types'

// margen sobre el precio de venta, en %
export function calcularMargen(costo: number, venta: number): number {
  if (venta <= 0) return 0
  return ((venta - costo) / venta) * 100
}

export type ResumenInventario = {
  totalProductos: number
  valorVenta: number
  costoBase: number
  bajoStock: number
  sinStock: number
  margenPromedio: number
}

// tarjetas de arriba: se calculan de los mismos productos, nada se inventa
export function calcularResumenInventario(productos: ProductoInventario[]): ResumenInventario {
  let valorVenta = 0
  let costoBase = 0
  let bajoStock = 0
  let sinStock = 0
  let sumaMargenes = 0

  for (const producto of productos) {
    valorVenta += producto.stock_actual * producto.precio_venta
    costoBase += producto.stock_actual * producto.precio_compra
    sumaMargenes += calcularMargen(producto.precio_compra, producto.precio_venta)

    if (producto.stock_actual <= 0) {
      sinStock += 1
    } else if (producto.stock_actual <= producto.stock_minimo) {
      bajoStock += 1
    }
  }

  return {
    totalProductos: productos.length,
    valorVenta,
    costoBase,
    bajoStock,
    sinStock,
    margenPromedio: productos.length > 0 ? sumaMargenes / productos.length : 0,
  }
}

// estado de una fila de stock, para pintar la barra de color
export function estadoStock(producto: ProductoInventario): 'sin-stock' | 'bajo' | 'normal' {
  if (producto.stock_actual <= 0) return 'sin-stock'
  if (producto.stock_actual <= producto.stock_minimo) return 'bajo'
  return 'normal'
}

// src/features/dashboard/utils/comparacionMercado.ts
import type { ProductoInventario } from '@/features/inventario/types'
import type { TendenciaMercado } from '@/features/dashboard/types'

// la tendencia cruzada con el producto propio, si es que lo tenemos en catalogo
export type TendenciaComparada = TendenciaMercado & {
  producto: ProductoInventario | null
  margenPorc: number | null // margen propio actual
  diferenciaPorc: number | null // cuanto mas caro (+) o barato (-) estoy vs el mercado
}

// margen sobre el precio de venta
function calcularMargen(producto: ProductoInventario): number | null {
  if (!producto.precio_venta) return null
  return Math.round(((producto.precio_venta - producto.precio_compra) / producto.precio_venta) * 100)
}

// cruza las tendencias con el catalogo propio por sku, ordenadas por demanda
export function compararConMercado(
  tendencias: TendenciaMercado[],
  productos: ProductoInventario[],
): TendenciaComparada[] {
  const porSku = new Map(productos.map((producto) => [producto.sku, producto]))

  return tendencias
    .map((tendencia): TendenciaComparada => {
      const producto = porSku.get(tendencia.sku) ?? null

      const diferenciaPorc =
        producto && tendencia.averageMarketPrice
          ? Math.round(((producto.precio_venta - tendencia.averageMarketPrice) / tendencia.averageMarketPrice) * 100)
          : null

      return {
        ...tendencia,
        producto,
        margenPorc: producto ? calcularMargen(producto) : null,
        diferenciaPorc,
      }
    })
    .sort((a, b) => b.demandIndex - a.demandIndex)
}

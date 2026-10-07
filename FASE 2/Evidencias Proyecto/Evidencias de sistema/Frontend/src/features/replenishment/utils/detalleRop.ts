// src/features/dashboard/utils/detalleRop.ts
import type { ConfigRop, OrdenSugerida, ProductoBajoStock } from '@/features/replenishment/types'
import type { CandidatoProveedor } from '@/features/replenishment/types'

export type SeveridadRop = 'AGOTADO' | 'CRITICO' | 'PREVENTIVO'

// el producto bajo rop con el detalle del calculo y el proveedor que lo surte
export type FilaRop = ProductoBajoStock & {
  severidad: SeveridadRop
  deficit: number // cuanto falta para llegar al punto de reorden
  cantidadSugerida: number
  costoEstimado: number
  proveedorId: string | null
  candidatos: CandidatoProveedor[]
}

// agotado > critico (bajo el minimo) > preventivo (bajo el rop pero sobre el minimo)
function calcularSeveridad(producto: ProductoBajoStock): SeveridadRop {
  if (producto.is_agotado || producto.stock_actual <= 0) return 'AGOTADO'
  if (producto.stock_actual < producto.stock_minimo) return 'CRITICO'
  return 'PREVENTIVO'
}

// cruza el calculo rop con el proveedor de cada orden
export function armarFilasRop(productos: ProductoBajoStock[], ordenes: OrdenSugerida[]): FilaRop[] {
  // indexar las lineas de las ordenes por producto
  const lineas = new Map(
    ordenes.flatMap((orden) => orden.items.map((item) => [item.producto_id, { item, orden }] as const)),
  )

  return productos
    .map((producto): FilaRop => {
      const linea = lineas.get(producto.producto_id)

      return {
        ...producto,
        severidad: calcularSeveridad(producto),
        deficit: producto.stock_actual - producto.reorder_point,
        cantidadSugerida: linea?.item.cantidad_sugerida ?? 0,
        costoEstimado: linea?.item.costo_estimado ?? 0,
        proveedorId: linea?.orden.proveedor_id ?? null,
        candidatos: linea?.item.candidatos_proveedores ?? [],
      }
    })
    .sort((a, b) => a.dias_inventario_restante - b.dias_inventario_restante)
}

// "en 1,2 d" o "en 28 h" segun que tan cerca esta el quiebre
export function tiempoHastaQuiebre(dias: number): string {
  if (dias >= 999) return 'sin consumo'
  if (dias < 1) return `en ${Math.max(1, Math.round(dias * 24))} h`
  return `en ${dias.toFixed(1)} d`
}

// como se compone el punto de reorden, con los parametros que se estan usando
export function formulaRop(producto: ProductoBajoStock, config: ConfigRop): string {
  return `D ${producto.velocidad_diaria}/d x L ${config.leadTimeDays}d + min ${producto.stock_minimo}`
}

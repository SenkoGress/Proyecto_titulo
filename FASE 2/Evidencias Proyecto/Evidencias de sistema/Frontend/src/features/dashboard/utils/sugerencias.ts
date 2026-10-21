// src/features/dashboard/utils/sugerencias.ts
import type { ProductoVencimiento } from '@/features/inventario/types'
import type { VelocidadProducto } from '@/features/replenishment/types'

export type TipoSugerencia = 'rotacion' | 'vencimiento'

export type Sugerencia = {
  id: string
  nombre: string
  tipo: TipoSugerencia
  motivo: string
  urgencia: number
}

// desde aqui un vencimiento ya aprieta. es el mismo tramo que el backend
// usa para el semaforo sanitario
const DIAS_PARA_LIQUIDAR = 30

const CUANTAS_MOSTRAR = 6

// se vende y ya esta bajo el punto de reorden que calcula reposicion.
// el umbral no se inventa aca: es el que el sistema ya usa para pedir
export function sugerenciasPorRotacion(velocidades: VelocidadProducto[]): Sugerencia[] {
  return velocidades
    .filter((p) => p.velocityDaily > 0 && p.isUnderStock)
    .map((p) => ({
      id: p.productId,
      nombre: p.nombre,
      tipo: 'rotacion' as const,
      motivo: p.isAgotado
        ? `Agotado y se vende ${p.velocityDaily} al dia`
        : `Quedan ${p.stockActual} y se vende ${p.velocityDaily} al dia`,
      urgencia: p.isAgotado ? 0 : p.stockActual,
    }))
}

// vence pronto y todavia queda stock que alcanza a venderse con una oferta.
// un producto ya vencido no entra: ese no se promociona, se retira
export function sugerenciasPorVencimiento(vencimientos: ProductoVencimiento[]): Sugerencia[] {
  return vencimientos
    .filter(
      (p) =>
        p.dias_restantes >= 0 &&
        p.dias_restantes <= DIAS_PARA_LIQUIDAR &&
        (p.unidades_por_vencer ?? 0) > 0,
    )
    .map((p) => ({
      id: p.id,
      nombre: p.nombre,
      tipo: 'vencimiento' as const,
      motivo: `${p.unidades_por_vencer} un. vencen en ${p.dias_restantes} dias`,
      urgencia: p.dias_restantes,
    }))
}

// las dos reglas juntas, lo mas apretado primero
export function armarSugerencias(
  velocidades: VelocidadProducto[],
  vencimientos: ProductoVencimiento[],
): Sugerencia[] {
  return [...sugerenciasPorVencimiento(vencimientos), ...sugerenciasPorRotacion(velocidades)]
    .sort((a, b) => a.urgencia - b.urgencia)
    .slice(0, CUANTAS_MOSTRAR)
}

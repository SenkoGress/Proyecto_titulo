// src/features/inventario/utils/filtrosVencimientos.ts
import { TODAS_CATEGORIAS } from '@/features/inventario/utils/categoriasInventario'
import type { FilaFefo } from '@/features/inventario/utils/matrizFefo'

// valor especial de "categoria" que en realidad activa el filtro de criticos fefo
export const SOLO_CRITICOS = 'CriticosFefo'
// todo lo que el decreto obliga a vigilar: vencidos, <=7 dias y 15 dias
export const EN_RIESGO_SANITARIO = 'EnRiesgoSanitario'

function esCritico(producto: FilaFefo): boolean {
  return producto.nivel === 'ROJO_CRITICO' || producto.nivel === 'NARANJA_URGENTE'
}

function estaEnRiesgo(producto: FilaFefo): boolean {
  return esCritico(producto) || producto.nivel === 'AMARILLO_ALERTA'
}

// combina el filtro de categoria (o riesgo sanitario) con la busqueda de texto
export function filtrarInventarioFefo(productos: FilaFefo[], filtro: string, busqueda: string): FilaFefo[] {
  const texto = busqueda.trim().toLowerCase()

  return productos.filter((producto) => {
    let coincideFiltro: boolean
    if (filtro === TODAS_CATEGORIAS) {
      coincideFiltro = true
    } else if (filtro === SOLO_CRITICOS) {
      coincideFiltro = esCritico(producto)
    } else if (filtro === EN_RIESGO_SANITARIO) {
      coincideFiltro = estaEnRiesgo(producto)
    } else {
      coincideFiltro = (producto.categoria ?? 'Sin categoria') === filtro
    }

    const coincideTexto =
      texto === '' ||
      producto.nombre.toLowerCase().includes(texto) ||
      producto.sku.toLowerCase().includes(texto) ||
      (producto.codigo_barra ?? '').includes(texto)

    return coincideFiltro && coincideTexto
  })
}

// cuantos productos son criticos, para el numero del chip
export function contarCriticos(productos: FilaFefo[]): number {
  return productos.filter(esCritico).length
}

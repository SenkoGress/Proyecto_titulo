// src/features/inventario/utils/unidadesPorVencer.ts

// GET /pos/vencimientos distingue tres situaciones y hay que mostrarlas distinto:
// un numero son las unidades que vencen en esa fecha, cero es que no queda stock,
// y null es que se conoce la fecha pero no cuantas unidades vencen en ella
export function textoUnidadesPorVencer(unidades: number | null | undefined): string | null {
  if (unidades === null || unidades === undefined) return null
  if (unidades === 0) return 'sin stock'
  return `${unidades} un.`
}

// un producto solo cuenta para el riesgo si de verdad quedan unidades por vencer
export function tieneUnidadesEnRiesgo(unidades: number | null | undefined): boolean {
  return typeof unidades === 'number' && unidades > 0
}

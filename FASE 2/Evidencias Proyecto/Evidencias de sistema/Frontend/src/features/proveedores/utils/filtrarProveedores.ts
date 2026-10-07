// src/features/proveedores/utils/filtrarProveedores.ts
import type { FichaProveedor } from '@/features/proveedores/utils/fichaProveedor'

export const TODOS_LOS_RUBROS = 'Todos'

// rubros presentes en el directorio, con cuantos proveedores tiene cada uno
export function contarRubros(fichas: FichaProveedor[]) {
  const conteo = new Map<string, number>()

  for (const ficha of fichas) {
    for (const rubro of ficha.rubros) {
      conteo.set(rubro, (conteo.get(rubro) ?? 0) + 1)
    }
  }

  return [
    { nombre: TODOS_LOS_RUBROS, cantidad: fichas.length },
    ...[...conteo.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([nombre, cantidad]) => ({ nombre, cantidad })),
  ]
}

// busca por nombre, rut, giro o telefono, y filtra por rubro
export function filtrarProveedores(fichas: FichaProveedor[], rubro: string, busqueda: string): FichaProveedor[] {
  const texto = busqueda.trim().toLowerCase()

  return fichas.filter((ficha) => {
    const coincideRubro = rubro === TODOS_LOS_RUBROS || ficha.rubros.includes(rubro)

    const coincideTexto =
      texto === '' ||
      ficha.nombre_proveedores.toLowerCase().includes(texto) ||
      ficha.rut_proveedor.toLowerCase().includes(texto) ||
      ficha.giro.toLowerCase().includes(texto) ||
      ficha.telefono.toLowerCase().includes(texto)

    return coincideRubro && coincideTexto
  })
}

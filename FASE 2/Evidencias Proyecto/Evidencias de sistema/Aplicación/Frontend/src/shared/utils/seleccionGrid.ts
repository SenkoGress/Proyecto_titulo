// src/shared/utils/seleccionGrid.ts
import type { GridRowSelectionModel } from '@mui/x-data-grid'

// el DataGrid entrega un modo y un conjunto, no una lista de ids
export const SELECCION_VACIA: GridRowSelectionModel = { type: 'include', ids: new Set() }

export function estaSeleccionada(seleccion: GridRowSelectionModel, id: string): boolean {
  const contenida = seleccion.ids.has(id)
  return seleccion.type === 'include' ? contenida : !contenida
}

// filtra una lista de filas dejando solo las seleccionadas
export function filasSeleccionadas<T extends { id: string }>(
  filas: T[],
  seleccion: GridRowSelectionModel,
): T[] {
  return filas.filter((fila) => estaSeleccionada(seleccion, fila.id))
}

// src/features/pos/components/tecnico/ids.ts

// id del buscador (para F2)
export const ID_BUSCADOR = 'buscador-pos'

// id del campo cantidad de una linea (para F3)
export function idCampoCantidad(productoId: string): string {
  return `cantidad-${productoId}`
}

// src/features/invoices/utils/facturaDuplicada.ts
import type { FacturaRegistrada } from '@/features/invoices/types'

// el rut viene con puntos, con guion o pelado, segun quien lo escriba
function normalizarRut(rut: string | null | undefined): string {
  return (rut ?? '').replace(/[.\s-]/g, '').toUpperCase()
}

function normalizarFolio(folio: string | null | undefined): string {
  return (folio ?? '').trim().replace(/^0+/, '').toUpperCase()
}

// el mismo folio del mismo proveedor ya entro antes. el backend todavia no lo
// rechaza, asi que el aviso evita que el stock suba dos veces por una compra
export function facturaYaIngresada(
  folio: string | null | undefined,
  rutProveedor: string | null | undefined,
  registradas: FacturaRegistrada[],
): FacturaRegistrada | null {
  const buscado = normalizarFolio(folio)
  if (!buscado) return null

  const rut = normalizarRut(rutProveedor)

  return (
    registradas.find(
      (f) =>
        normalizarFolio(f.numero_factura) === buscado &&
        (rut === '' || normalizarRut(f.rut_proveedor) === rut),
    ) ?? null
  )
}

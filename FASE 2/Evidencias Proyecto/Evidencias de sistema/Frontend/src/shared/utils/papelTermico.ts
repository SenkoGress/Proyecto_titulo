// src/shared/utils/papelTermico.ts

// anchos de rollo de las impresoras termicas de punto de venta
export type AnchoPapel = 58 | 80

export const ANCHOS_PAPEL: AnchoPapel[] = [58, 80]

// lo que la impresora deja libre a cada lado del rollo
const MARGEN_MM = 4

// el ticket de 80mm siempre se dibujo con este ancho, y se conserva
const PX_ROLLO_80 = 320

export function esAnchoPapel(valor: unknown): valor is AnchoPapel {
  return valor === 58 || valor === 80
}

// ancho de la vista previa, proporcional al rollo
export function anchoVistaPx(ancho: AnchoPapel): number {
  return Math.round((PX_ROLLO_80 * ancho) / 80)
}

// en 58mm entra menos texto por linea, asi que la letra baja
export function tamanoLetraPx(ancho: AnchoPapel): number {
  return ancho === 58 ? 10 : 12
}

// la regla que recibe la ventana de impresion
export function reglaPagina(ancho: AnchoPapel): string {
  return `@page { size: ${ancho}mm auto; margin: ${MARGEN_MM}mm; }`
}

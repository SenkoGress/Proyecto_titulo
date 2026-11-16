// src/shared/utils/formatoClp.ts

// 18420 -> $18.420
export function formatoClp(monto: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(monto)
}

// version corta para los ejes de los graficos: 287740 -> $288k
export function formatoClpCorto(monto: number): string {
  if (Math.abs(monto) >= 1_000_000) return `$${Math.round(monto / 100_000) / 10}M`
  if (Math.abs(monto) >= 1_000) return `$${Math.round(monto / 1_000)}k`
  return `$${monto}`
}

// src/shared/utils/redondeoChileno.ts

// ley 20.956: 1-4 baja, 5-9 sube a la decena
export function aplicarRedondeoChileno(valor: number): number {
  if (Number.isNaN(valor)) return 0

  const entero = Math.round(valor)
  const ultimoDigito = Math.abs(entero) % 10

  if (ultimoDigito >= 1 && ultimoDigito <= 4) {
    return entero - ultimoDigito
  }

  if (ultimoDigito >= 5 && ultimoDigito <= 9) {
    return entero + (10 - ultimoDigito)
  }

  return entero
}

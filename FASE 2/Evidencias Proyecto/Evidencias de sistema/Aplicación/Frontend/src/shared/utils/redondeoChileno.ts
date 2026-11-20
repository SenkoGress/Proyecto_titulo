// src/shared/utils/redondeoChileno.ts

// ley 20.956: 1-5 baja, 6-9 sube a la decena
export function aplicarRedondeoChileno(valor: number): number {
  if (Number.isNaN(valor)) return 0

  const entero = Math.round(valor)
  const ultimoDigito = Math.abs(entero) % 10

  // el articulo 13 de la Ley N 20.956 baja el 5: hasta 5 a la decena inferior, desde 6 a la superior
  if (ultimoDigito >= 1 && ultimoDigito <= 5) {
    return entero - ultimoDigito
  }

  if (ultimoDigito >= 6 && ultimoDigito <= 9) {
    return entero + (10 - ultimoDigito)
  }

  return entero
}

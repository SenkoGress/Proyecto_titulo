// src/shared/utils/codigoBarra.ts

// digito verificador de un EAN-13: posiciones impares x1, pares x3
function digitoVerificadorEan13(doceDigitos: string): number {
  let suma = 0

  for (let i = 0; i < 12; i++) {
    suma += Number(doceDigitos[i]) * (i % 2 === 0 ? 1 : 3)
  }

  return (10 - (suma % 10)) % 10
}

// un codigo sirve como EAN-13 solo si son 13 digitos y el ultimo cuadra
export function esEan13Valido(codigo: string | null): boolean {
  if (!codigo) return false

  const limpio = codigo.trim()
  if (!/^\d{13}$/.test(limpio)) return false

  return digitoVerificadorEan13(limpio) === Number(limpio[12])
}

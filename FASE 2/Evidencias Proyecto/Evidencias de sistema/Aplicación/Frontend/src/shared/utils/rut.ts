// src/shared/utils/rut.ts

// dejar solo numeros y k
export function limpiarRut(rut: string): string {
  return rut.replace(/[^0-9kK]/g, '').toUpperCase()
}

// validar digito verificador (modulo 11)
export function validarRut(rut: string): boolean {
  const limpio = limpiarRut(rut)
  if (limpio.length < 2) return false

  const cuerpo = limpio.slice(0, -1)
  const digito = limpio.slice(-1)
  if (!/^\d+$/.test(cuerpo)) return false

  let suma = 0
  let multiplicador = 2

  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * multiplicador
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1
  }

  const resto = 11 - (suma % 11)
  const esperado = resto === 11 ? '0' : resto === 10 ? 'K' : String(resto)

  return digito === esperado
}

// 12345678k -> 12.345.678-K
export function formatearRut(rut: string): string {
  const limpio = limpiarRut(rut)
  if (limpio.length < 2) return limpio

  const cuerpo = limpio.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${cuerpo}-${limpio.slice(-1)}`
}

// formato del sii: 12345678-K
export function rutParaSii(rut: string): string {
  const limpio = limpiarRut(rut)
  return `${limpio.slice(0, -1)}-${limpio.slice(-1)}`
}

/**
 * Utilidades para Facturación Electrónica y Reglas Tributarias del SII (Chile)
 */

/**
 * Valida un RUT chileno aplicando el algoritmo estándar de Módulo 11 (Ley N° 20.727 y SII)
 * @param rut RUT en formato '12.345.678-5', '12345678-5', '76.123.456-0', etc.
 * @returns true si el dígito verificador coincide exactamente, false en caso contrario
 */
export function rutValido(rut: string): boolean {
  if (!rut || typeof rut !== 'string') return false;
  const limpio = rut.replace(/\./g, '').replace(/-/g, '').trim();
  if (limpio.length < 2) return false;

  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1).toUpperCase();
  if (!/^\d+$/.test(cuerpo)) return false;

  let suma = 0;
  let multiplicador = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * multiplicador;
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
  }

  const resto = 11 - (suma % 11);
  const esperado = resto === 11 ? '0' : resto === 10 ? 'K' : String(resto);
  return dv === esperado;
}

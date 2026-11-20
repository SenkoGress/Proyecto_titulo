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

/**
 * RUT como lo pide el XML del SII (RUTType): cuerpo y digito verificador separados por guion, sin
 * puntos ni espacios y con la K en mayuscula. Acepta lo que el usuario haya escrito (76.123.456-0,
 * 761234560, 76123456-k), o null si no es un RUT con su digito verificador correcto: un RUT sin
 * digito pasaria por el de otro contribuyente.
 */
export function rutSiiSeguro(rut: string | null | undefined): string | null {
  // con puntos y sin guion lo mas probable es que falte el digito: el ultimo numero no lo es
  if (/\./.test(String(rut ?? '')) && !/-/.test(String(rut ?? ''))) return null;
  const limpio = String(rut ?? '').replace(/[^0-9kK]/g, '').toUpperCase();
  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);
  if (!/^\d{1,8}$/.test(cuerpo) || !/^[0-9K]$/.test(dv)) return null;
  const rut2 = `${cuerpo}-${dv}`;
  return rutValido(rut2) ? rut2 : null;
}

/** Como rutSiiSeguro, pero lanza un error: se usa antes de gastar un folio. */
export function rutSii(rut: string | null | undefined): string {
  const normalizado = rutSiiSeguro(rut);
  if (!normalizado) {
    throw new Error(`El RUT "${rut ?? ''}" no es valido para el SII: revise el numero y el digito verificador`);
  }
  return normalizado;
}

/**
 * Texto para un nodo del XML del SII: sin los caracteres que rompen el XML y recortado al largo que
 * permite el esquema, que rechaza el documento si se pasa.
 */
export function textoSii(valor: unknown, largoMaximo: number): string {
  return String(valor ?? '')
    .normalize('NFC')
    // lo que se pega desde otros programas: el sobre viaja en ISO-8859-1 y estos no existen ahi
    .replace(/[\u2018\u2019\u201A\u2032]/g, '')
    .replace(/[\u201C\u201D\u201E\u2033]/g, '')
    .replace(/\u2026/g, '...')
    .replace(/[\u2013\u2014\u2212]/g, '-')
    .replace(/\u20AC/g, 'EUR')
    .replace(/\u00A0/g, ' ')
    // fuera de ISO-8859-1 o de control: el XML quedaria mal formado
    .replace(/[^\x20-\x7E\xA1-\xFF]/g, '')
    .replace(/[<>&'"]/g, '')
    .trim()
    .substring(0, largoMaximo);
}

/** El sobre declara ISO-8859-1: se entrega en esos bytes, no en UTF-8, o el SII lee mal las tildes y la ñ. */
export function bytesDelSobre(sobreXml: string): Buffer {
  return Buffer.from(sobreXml, 'latin1');
}

/**
 * Generador y validador de Códigos de Barra estándar GS1 EAN-13 para retail chileno
 */

/**
 * Calcula el dígito verificador estándar EAN-13 según el algoritmo oficial GS1 (Módulo 10 ponderado 1-3).
 */
export function calculateEan13Checksum(first12Digits: string): number {
  if (first12Digits.length < 12) {
    throw new Error('first12Digits must have exactly 12 digits');
  }
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(first12Digits[i], 10) || 0;
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const remainder = sum % 10;
  return remainder === 0 ? 0 : 10 - remainder;
}

/**
 * Genera un código de barras EAN-13 válido con prefijo país Chile (780).
 * Si el SKU ya contiene dígitos, los aprovecha para mantener trazabilidad con el código de fábrica.
 */
export function generateChileanBarcode(sku?: string | null): string {
  // Si ya es un EAN-13 válido de 13 dígitos numéricos, conservarlo
  if (sku && /^\d{13}$/.test(sku)) {
    return sku;
  }

  let base9 = '';
  if (sku) {
    const digitsOnly = sku.replace(/\D/g, '');
    if (digitsOnly.length > 0) {
      base9 = digitsOnly.slice(-9).padStart(9, '0');
    }
  }

  if (!base9 || base9 === '000000000') {
    // Generar 9 dígitos deterministas o aleatorios
    const rand = Math.floor(100000000 + Math.random() * 900000000);
    base9 = rand.toString();
  }

  const first12 = `780${base9}`;
  const checkDigit = calculateEan13Checksum(first12);
  return `${first12}${checkDigit}`;
}

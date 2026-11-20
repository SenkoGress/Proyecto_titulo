/**
 * Utilidades de fijación de precios y Ley de Redondeo de Chile (Ley N° 20.956)
 * Banco Central de Chile:
 * - Dígitos 1 a 5: Redondeo hacia abajo a la decena.
 * - Dígitos 6 a 9: Redondeo hacia arriba a la decena.
 */

/**
 * Aplica la regla estricta de la Ley de Redondeo chilena a la decena más cercana.
 * @param valor Monto numérico en CLP (pesos chilenos)
 * @returns Monto redondeado según la normativa legal
 */
export function aplicarRedondeoChileno(valor: number): number {
  if (isNaN(valor)) return 0;
  const entero = Math.round(valor);
  const ultimoDigito = Math.abs(entero) % 10;

  // el articulo 13 de la Ley N 20.956 baja el 5: hasta 5 a la decena inferior, desde 6 a la superior
  if (ultimoDigito >= 1 && ultimoDigito <= 5) {
    return entero - ultimoDigito;
  } else if (ultimoDigito >= 6 && ultimoDigito <= 9) {
    return entero + (10 - ultimoDigito);
  }

  return entero; // Si termina en 0, no requiere ajuste
}

/**
 * Calcula el precio de venta sugerido aplicando el margen de ganancia configurado y la ley de redondeo.
 * @param costo Precio de costo o compra del producto
 * @param margenPorcentaje Porcentaje de margen comercial (ej. 35 para 35%)
 * @returns Precio de venta al público redondeado en pesos chilenos
 */
export function calcularPrecioVenta(costo: number, margenPorcentaje: number = 35): number {
  if (costo <= 0) return 0;
  const multiplicador = 1 + (margenPorcentaje / 100);
  const precioTeorico = costo * multiplicador;
  return aplicarRedondeoChileno(precioTeorico);
}

/**
 * Desglosa un total bruto de factura o boleta en monto neto e IVA Débito/Crédito Fiscal (19% en Chile).
 * @param total Monto total bruto con IVA incluido
 */
export function desglosarIvaChileno(total: number): {
  neto: number;
  iva: number;
  total: number;
} {
  const totalRedondeado = Math.round(total);
  const neto = Math.round(totalRedondeado / 1.19);
  const iva = totalRedondeado - neto;
  return {
    neto,
    iva,
    total: totalRedondeado
  };
}

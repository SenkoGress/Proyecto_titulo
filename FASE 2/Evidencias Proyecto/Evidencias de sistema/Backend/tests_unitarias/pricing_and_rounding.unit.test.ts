import { aplicarRedondeoChileno, calcularPrecioVenta, desglosarIvaChileno } from '../src/utils/pricing';

describe('Pruebas Unitarias: Normativa de Precios, Ley N° 20.956 e Impuestos Chilenos', () => {
  describe('Ley de Redondeo en Efectivo (Ley N° 20.956)', () => {
    test('redondea hacia abajo a la decena si el ultimo digito termina en 1, 2, 3 o 4', () => {
      expect(aplicarRedondeoChileno(1001)).toBe(1000);
      expect(aplicarRedondeoChileno(1002)).toBe(1000);
      expect(aplicarRedondeoChileno(1003)).toBe(1000);
      expect(aplicarRedondeoChileno(1004)).toBe(1000);
      expect(aplicarRedondeoChileno(54)).toBe(50);
    });

    test('redondea hacia arriba a la decena si el ultimo digito termina en 5, 6, 7, 8 o 9', () => {
      expect(aplicarRedondeoChileno(1005)).toBe(1010);
      expect(aplicarRedondeoChileno(1006)).toBe(1010);
      expect(aplicarRedondeoChileno(1007)).toBe(1010);
      expect(aplicarRedondeoChileno(1008)).toBe(1010);
      expect(aplicarRedondeoChileno(1009)).toBe(1010);
      expect(aplicarRedondeoChileno(55)).toBe(60);
    });

    test('conserva el valor inalterado si el ultimo digito termina en 0', () => {
      expect(aplicarRedondeoChileno(1000)).toBe(1000);
      expect(aplicarRedondeoChileno(2500)).toBe(2500);
      expect(aplicarRedondeoChileno(0)).toBe(0);
    });
  });

  describe('Desglose de IVA (19%) sobre Ventas y Facturas', () => {
    test('calcula correctamente el Neto y el IVA a partir de un valor Bruto', () => {
      const bruto = 1190;
      const { neto, iva, total } = desglosarIvaChileno(bruto);

      expect(neto).toBe(1000);
      expect(iva).toBe(190);
      expect(neto + iva).toBe(total);
    });

    test('desglosa montos comerciales de retail con precision de redondeo', () => {
      const bruto = 2500;
      const { neto, iva, total } = desglosarIvaChileno(bruto);

      expect(neto + iva).toBe(total);
      expect(total).toBe(bruto);
    });
  });

  describe('Calculo de Precio de Venta Comercial con Margen de Ganancia', () => {
    test('aplica margen porcentual sobre costo neto e incorpora redondeo chileno', () => {
      const costo = 1000;
      const margenPorcentaje = 30; // 30% margen

      const precioVenta = calcularPrecioVenta(costo, margenPorcentaje);

      // Costo con margen 30%: 1000 * 1.30 = 1300
      expect(precioVenta).toBe(1300);
    });

    test('retorna 0 si el costo es menor o igual a 0', () => {
      expect(calcularPrecioVenta(0)).toBe(0);
      expect(calcularPrecioVenta(-100)).toBe(0);
    });
  });
});

import { pesos } from '../../backend/src/ocr/gemini-ocr.provider';

/**
 * El modelo a veces devuelve "48.766" como numero con decimales. El peso chileno no los tiene: un
 * monto con decimales es un punto de miles mal leido.
 */
describe('Pruebas Unitarias: montos de la factura leida, siempre en pesos enteros', () => {
  test('un monto con decimales se lee como miles', () => {
    expect(pesos(48.766)).toBe(48766);
    expect(pesos(1.09)).toBe(1090);
    expect(pesos('40.98')).toBe(40980);
  });

  test('un monto entero no se toca, y lo que no es numero vale cero', () => {
    expect(pesos(48766)).toBe(48766);
    expect(pesos('690')).toBe(690);
    expect(pesos(undefined)).toBe(0);
  });
});

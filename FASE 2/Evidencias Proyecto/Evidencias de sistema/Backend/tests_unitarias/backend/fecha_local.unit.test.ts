import { fechaLocal, marcaLocal, mesLocal } from '../../backend/src/utils/fecha-local';

describe('Pruebas Unitarias: Fecha del reloj local', () => {
  // Las 22:30 del 30 de noviembre en el reloj del equipo, sea cual sea su zona horaria
  const nocheDeFinDeMes = new Date(2026, 10, 30, 22, 30, 5);

  test('la fecha es la del dia local, no la de UTC', () => {
    expect(fechaLocal(nocheDeFinDeMes)).toBe('2026-11-30');
  });

  test('el mes no salta al siguiente en la noche del ultimo dia', () => {
    expect(mesLocal(nocheDeFinDeMes)).toBe('2026-11');
  });

  test('la marca de tiempo lleva la hora local en el formato del SII', () => {
    expect(marcaLocal(nocheDeFinDeMes)).toBe('2026-11-30T22:30:05');
  });

  test('rellena con cero los meses, dias y horas de un digito', () => {
    expect(marcaLocal(new Date(2027, 0, 5, 7, 4, 9))).toBe('2027-01-05T07:04:09');
  });
});

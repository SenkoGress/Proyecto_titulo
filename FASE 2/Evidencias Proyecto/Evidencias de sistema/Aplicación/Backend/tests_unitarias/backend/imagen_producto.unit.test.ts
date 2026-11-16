import { motivoImagenInvalida, TOPE_IMAGEN_CARACTERES } from '../../backend/src/inventory/imagen-producto';

describe('Pruebas Unitarias: Foto del producto', () => {
  const base64 = Buffer.from('foto').toString('base64');

  test('sin foto es valido: null y ausente', () => {
    expect(motivoImagenInvalida(null)).toBeNull();
    expect(motivoImagenInvalida(undefined)).toBeNull();
  });

  test('acepta data URL JPEG, PNG y WebP', () => {
    for (const tipo of ['jpeg', 'png', 'webp']) {
      expect(motivoImagenInvalida(`data:image/${tipo};base64,${base64}`)).toBeNull();
    }
  });

  test('rechaza una direccion de otro sitio, otro formato o texto que no es base64', () => {
    expect(motivoImagenInvalida('https://images.openfoodfacts.org/foto.jpg')).toMatch(/data URL/);
    expect(motivoImagenInvalida(`data:image/svg+xml;base64,${base64}`)).toMatch(/data URL/);
    expect(motivoImagenInvalida('data:image/png;base64,<script>')).toMatch(/data URL/);
    expect(motivoImagenInvalida(12345)).toMatch(/data URL/);
  });

  test('rechaza una foto sin reducir que supera el tope', () => {
    const grande = `data:image/jpeg;base64,${'A'.repeat(TOPE_IMAGEN_CARACTERES)}`;
    expect(motivoImagenInvalida(grande)).toMatch(/300 KB/);
  });
});

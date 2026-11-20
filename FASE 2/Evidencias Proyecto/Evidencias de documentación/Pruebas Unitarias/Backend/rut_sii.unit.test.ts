import { rutSii, rutSiiSeguro, textoSii } from '../../backend/src/utils/sii.utils';

describe('Pruebas Unitarias: RUT y textos para el XML del SII', () => {
  test('deja el RUT como lo pide el esquema: sin puntos, con guion y K mayuscula', () => {
    expect(rutSii('76.123.456-0')).toBe('76123456-0');
    expect(rutSii('76123456-0')).toBe('76123456-0');
    expect(rutSii('12.345.670-k')).toBe('12345670-K');
    expect(rutSii(' 12 345 678 - 5 ')).toBe('12345678-5');
    // sin guion tambien se entiende: el ultimo caracter es el digito verificador
    expect(rutSii('761234560')).toBe('76123456-0');
    expect(rutSii('66666666-6')).toBe('66666666-6');
  });

  test('un RUT que no se puede leer se rechaza en vez de llegar al documento', () => {
    expect(() => rutSii('')).toThrow(/RUT/);
    expect(() => rutSii(null)).toThrow(/RUT/);
    expect(() => rutSii('5')).toThrow(/RUT/);
    expect(() => rutSii('sin rut')).toThrow(/RUT/);
    expect(() => rutSii('123456789-0')).toThrow(/RUT/);
  });

  test('un RUT con el digito verificador equivocado no pasa: seria el de otro contribuyente', () => {
    expect(() => rutSii('12.345.678-k')).toThrow(/digito verificador/);
    expect(() => rutSii('76.123.456-7')).toThrow(/RUT/);
    expect(rutSiiSeguro('76.123.456-7')).toBeNull();
    expect(rutSiiSeguro('S/R')).toBeNull();
    expect(rutSiiSeguro('11.111.111-1')).toBe('11111111-1');
    // con puntos y sin guion falta el digito: el ultimo numero no se toma como verificador
    expect(rutSiiSeguro('1.234.579')).toBeNull();
    expect(rutSiiSeguro('1234579')).toBe('123457-9');
    expect(rutSiiSeguro('12.345.678-5')).toBe('12345678-5');
  });

  test('los textos se limpian y se recortan al largo del esquema', () => {
    expect(textoSii('Almacen <Don> "Tito" & Cia', 100)).toBe('Almacen Don Tito  Cia');
    expect(textoSii('X'.repeat(50), 40)).toHaveLength(40);
    expect(textoSii(null, 10)).toBe('');
  });

  test('lo pegado desde otros programas queda en ISO-8859-1 y las tildes y la eñe se conservan', () => {
    expect(textoSii('Café “Especial” – 1 kg…', 100)).toBe('Café Especial - 1 kg...');
    expect(textoSii('Ñandú 20 €', 100)).toBe('Ñandú 20 EUR');
    expect(textoSii('pan’s\u00A0frescos', 100)).toBe('pans frescos');
    // la tilde escrita como letra mas acento combinado queda en un solo caracter
    expect(textoSii('Cafe\u0301', 100)).toBe('Café');
    expect(textoSii('emoji \uD83C\uDF5E y control\u0007', 100)).toBe('emoji  y control');
  });
});

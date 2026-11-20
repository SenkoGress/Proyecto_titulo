import { DteEmitterService, montoLinea } from '../../backend/src/dte/dte-emitter.service';
import { ItemDTE } from '../../backend/src/dte/types';

const emisor = new DteEmitterService();

function item(precioUnitario: number, cantidad = 1, extra: Partial<ItemDTE> = {}): ItemDTE {
  return { nroLinea: 1, nombre: 'Producto', cantidad, precioUnitario, subtotal: precioUnitario * cantidad, ...extra };
}

/** La regla que valida el SII: los totales suman exactamente el total del documento. */
function cuadra(t: ReturnType<DteEmitterService['calculateTotals']>) {
  return t.montoNeto + t.montoIva + (t.montoIla ?? 0) + t.montoExento === t.montoTotal;
}

describe('Pruebas Unitarias: Totales del documento tributario', () => {
  // con montos que terminan en cero el redondeo de la Ley 20.956 vale cero y no se ve nada
  test.each([
    ['1 x 1.234', [item(1234)], 1234],
    ['3 x 799', [item(799, 3)], 2397],
    ['1 x 1.005', [item(1005)], 1005],
    ['varias lineas', [item(1234), item(799, 3), item(1005), item(2190, 2)], 1234 + 2397 + 1005 + 4380]
  ])('la boleta de %s declara el monto real y cuadra', (_caso, items, total) => {
    const t = emisor.calculateTotals(items, false);

    expect(t.montoTotal).toBe(total);
    expect(cuadra(t)).toBe(true);
    // regla de la boleta: el neto se saca una vez sobre el total
    expect(t.montoNeto).toBe(Math.round(total / 1.19));
  });

  test('el total no lleva el redondeo de la Ley 20.956, sea cual sea el medio de pago', () => {
    expect(emisor.calculateTotals([item(1234)], false).montoTotal).toBe(1234);
    expect('redondeoChileno' in emisor.calculateTotals([item(1234)], false)).toBe(false);
  });

  test('lo exento se declara aparte y el documento sigue cuadrando', () => {
    const t = emisor.calculateTotals([item(1234), item(5000, 1, { exento: true })], false);

    expect(t.montoExento).toBe(5000);
    expect(t.montoTotal).toBe(6234);
    expect(t.montoNeto).toBe(Math.round(1234 / 1.19));
    expect(cuadra(t)).toBe(true);
  });

  test('la factura con impuesto adicional cuadra con el adicional desglosado', () => {
    const items = [
      item(1990, 3, { codigoIla: 26, tasaIla: 20.5 }),
      item(1234),
      item(2490, 1, { codigoIla: 271, tasaIla: 18 })
    ];

    const t = emisor.calculateTotals(items, true);

    expect(t.montoTotal).toBe(5970 + 1234 + 2490);
    expect(t.montoIla).toBeGreaterThan(0);
    expect(t.desgloseIla?.map((d) => d.codigo).sort()).toEqual([26, 271]);
    expect(cuadra(t)).toBe(true);
  });

  test('en la boleta el impuesto adicional no se desglosa: todo es neto e IVA', () => {
    const t = emisor.calculateTotals([item(1990, 3, { codigoIla: 26, tasaIla: 20.5 })], false);

    expect(t.montoIla).toBe(0);
    expect(t.desgloseIla).toEqual([]);
    expect(t.montoNeto).toBe(Math.round(5970 / 1.19));
    expect(cuadra(t)).toBe(true);
  });

  test('el monto de la linea es cantidad por precio, redondeado una sola vez', () => {
    expect(montoLinea({ cantidad: 0.5, precioUnitario: 1999 })).toBe(1000);
    expect(montoLinea({ cantidad: 3, precioUnitario: 799 })).toBe(2397);
    // el subtotal que mande quien llama no cambia el total: cantidad por precio manda
    expect(emisor.calculateTotals([{ ...item(799, 3), subtotal: 9999 }], false).montoTotal).toBe(2397);
  });
});

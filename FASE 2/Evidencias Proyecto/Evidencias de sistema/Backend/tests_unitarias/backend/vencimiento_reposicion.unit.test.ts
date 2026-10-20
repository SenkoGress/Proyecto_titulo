import { defaultSqliteClient } from '../../backend/src/database/sqlite/client';
import { initializeDatabase } from '../../backend/src/database/init-db';
import { defaultPgClient } from '../../backend/src/database/postgres/client';

const TENANT = '00000000-0000-0000-0000-000000000001';
const PRODUCTO = '00000000-0000-0000-0000-0000000ven01';

/**
 * Un producto tiene un solo campo `fecha_vencimiento`, no una tabla de lotes. Al reponer stock
 * la sentencia conservaba la ultima fecha recibida, de modo que un lote nuevo con vencimiento
 * lejano borraba el del stock antiguo que seguia en gondola. El panel de vencimientos dejaba de
 * avisar sobre mercaderia que si estaba por vencer.
 *
 * La regla implementada es que gana la fecha mas proxima. Mientras no existan lotes, el sistema
 * avisa de mas y nunca de menos, que es el lado seguro para el D.S. N° 977/96.
 */
describe('Pruebas Unitarias: Vencimiento Conservado al Reponer Stock', () => {
  beforeAll(async () => {
    defaultPgClient.tripCircuit();
    await initializeDatabase();
  });

  beforeEach(() => {
    defaultSqliteClient.execute('DELETE FROM productos WHERE id = ?', [PRODUCTO]);
  });

  afterAll(() => {
    defaultSqliteClient.execute('DELETE FROM productos WHERE id = ?', [PRODUCTO]);
  });

  function crear(fecha: string | null): void {
    defaultSqliteClient.execute(
      `INSERT INTO productos (id, tenant_id, sku, nombre, stock_actual, precio_compra, precio_venta, activo, fecha_vencimiento)
       VALUES (?, ?, 'SKU-VEN-01', 'Leche Entera 1L', 10, 700, 990, 1, ?)`,
      [PRODUCTO, TENANT, fecha]
    );
  }

  function reponer(fechaNueva: string | null): void {
    defaultSqliteClient.execute(
      `UPDATE productos
       SET stock_actual = stock_actual + 20,
           fecha_vencimiento = MIN(COALESCE(?, fecha_vencimiento), COALESCE(fecha_vencimiento, ?))
       WHERE id = ?`,
      [fechaNueva, fechaNueva, PRODUCTO]
    );
  }

  function fechaActual(): string | null {
    const fila = defaultSqliteClient.queryOne<{ fecha_vencimiento: string | null }>(
      'SELECT fecha_vencimiento FROM productos WHERE id = ?',
      [PRODUCTO]
    );
    return fila ? fila.fecha_vencimiento : null;
  }

  test('un lote nuevo de vencimiento lejano no borra el que vence antes', () => {
    crear('2026-10-25');

    reponer('2026-12-01');

    // Antes quedaba 2026-12-01 y las unidades que vencian el 25 desaparecian del panel
    expect(fechaActual()).toBe('2026-10-25');
  });

  test('un lote nuevo que vence antes si adelanta la fecha', () => {
    crear('2026-12-01');

    reponer('2026-10-25');

    expect(fechaActual()).toBe('2026-10-25');
  });

  test('reponer sin fecha conserva la que ya tenia el producto', () => {
    crear('2026-10-25');

    reponer(null);

    expect(fechaActual()).toBe('2026-10-25');
  });

  test('un producto sin fecha toma la del lote que llega', () => {
    crear(null);

    reponer('2026-11-15');

    expect(fechaActual()).toBe('2026-11-15');
  });

  test('sin fecha en ninguno de los dos lados el producto sigue sin fecha', () => {
    crear(null);

    reponer(null);

    expect(fechaActual()).toBeNull();
  });

  test('el stock se acumula en todos los casos', () => {
    crear('2026-10-25');

    reponer('2026-12-01');

    const fila = defaultSqliteClient.queryOne<{ stock_actual: number }>(
      'SELECT stock_actual FROM productos WHERE id = ?',
      [PRODUCTO]
    );
    // La fecha se elige, el stock se suma: son dos cosas distintas
    expect(Number(fila?.stock_actual)).toBe(30);
  });
});

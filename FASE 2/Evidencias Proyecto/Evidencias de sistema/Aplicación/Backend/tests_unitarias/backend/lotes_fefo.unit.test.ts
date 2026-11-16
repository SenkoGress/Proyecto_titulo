import { defaultSqliteClient } from '../../backend/src/database/sqlite/client';
import { initializeDatabase } from '../../backend/src/database/init-db';
import { defaultPgClient } from '../../backend/src/database/postgres/client';
import { LotesService } from '../../backend/src/inventory/lotes.service';

const TENANT = '00000000-0000-0000-0000-000000000001';
const PRODUCTO = '00000000-0000-0000-0000-00000000lot1';

/**
 * Con un solo campo por producto el sistema sabia QUE fecha vencia antes, pero no CUANTAS
 * unidades. La tabla de lotes separa la existencia por vencimiento y habilita el consumo
 * primero-en-vencer-primero-en-salir que exige el D.S. N° 977/96.
 *
 * La regla que gobierna todo este servicio: el stock del producto es la verdad y los lotes son
 * una capa contable. Si discrepan, la venta se registra igual y la diferencia se informa.
 */
describe('Pruebas Unitarias: Existencia por Lote y Consumo FEFO', () => {
  const lotes = new LotesService(defaultSqliteClient);

  beforeAll(async () => {
    defaultPgClient.tripCircuit();
    await initializeDatabase();
  });

  beforeEach(() => {
    defaultSqliteClient.execute('DELETE FROM lotes WHERE producto_id = ?', [PRODUCTO]);
    defaultSqliteClient.execute('DELETE FROM productos WHERE id = ?', [PRODUCTO]);
    defaultSqliteClient.execute(
      `INSERT INTO productos (id, tenant_id, sku, nombre, stock_actual, precio_compra, precio_venta, activo)
       VALUES (?, ?, 'SKU-LOTE-01', 'Leche Entera 1L', 0, 700, 990, 1)`,
      [PRODUCTO, TENANT]
    );
  });

  afterAll(() => {
    defaultSqliteClient.execute('DELETE FROM lotes WHERE producto_id = ?', [PRODUCTO]);
    defaultSqliteClient.execute('DELETE FROM productos WHERE id = ?', [PRODUCTO]);
  });

  function fechaProducto(): string | null {
    const f = defaultSqliteClient.queryOne<{ fecha_vencimiento: string | null }>(
      'SELECT fecha_vencimiento FROM productos WHERE id = ?',
      [PRODUCTO]
    );
    return f ? f.fecha_vencimiento : null;
  }

  describe('1. Registro de lotes', () => {
    test('una compra con fecha crea su lote y adelanta la fecha del producto', () => {
      lotes.registrar(TENANT, PRODUCTO, 10, '2026-12-01', 'L-DIC', 'FAC-1');
      expect(fechaProducto()).toBe('2026-12-01');

      lotes.registrar(TENANT, PRODUCTO, 20, '2026-10-25', 'L-OCT', 'FAC-2');

      // Dos lotes vivos conviven: la fecha del producto refleja el mas proximo
      expect(lotes.lotesDe(TENANT, PRODUCTO)).toHaveLength(2);
      expect(fechaProducto()).toBe('2026-10-25');
    });

    test('una compra sin fecha de vencimiento no genera lote', () => {
      expect(lotes.registrar(TENANT, PRODUCTO, 10, null)).toBeNull();
      expect(lotes.lotesDe(TENANT, PRODUCTO)).toHaveLength(0);
    });

    test('una cantidad no positiva no genera lote', () => {
      expect(lotes.registrar(TENANT, PRODUCTO, 0, '2026-12-01')).toBeNull();
      expect(lotes.registrar(TENANT, PRODUCTO, -5, '2026-12-01')).toBeNull();
    });
  });

  describe('2. Consumo primero lo que vence antes', () => {
    beforeEach(() => {
      lotes.registrar(TENANT, PRODUCTO, 10, '2026-10-25', 'L-OCT');
      lotes.registrar(TENANT, PRODUCTO, 20, '2026-12-01', 'L-DIC');
    });

    test('vender menos que el primer lote solo toca ese lote', () => {
      const r = lotes.consumirFefo(TENANT, PRODUCTO, 4);

      expect(r.consumido).toBe(4);
      expect(r.sinRespaldo).toBe(0);
      expect(r.detalle).toHaveLength(1);
      expect(r.detalle[0].fecha_vencimiento).toBe('2026-10-25');
      expect(fechaProducto()).toBe('2026-10-25');
    });

    test('vender mas que el primer lote cruza al siguiente, en orden', () => {
      const r = lotes.consumirFefo(TENANT, PRODUCTO, 15);

      expect(r.consumido).toBe(15);
      expect(r.detalle.map((d) => [d.fecha_vencimiento, d.cantidad])).toEqual([
        ['2026-10-25', 10],
        ['2026-12-01', 5]
      ]);
    });

    test('agotado el lote proximo, la fecha del producto pasa al siguiente', () => {
      lotes.consumirFefo(TENANT, PRODUCTO, 10);

      // Ya no queda nada venciendo en octubre: avisar de octubre seria falso
      expect(fechaProducto()).toBe('2026-12-01');
      expect(lotes.lotesDe(TENANT, PRODUCTO).map((l) => l.fecha_vencimiento)).toEqual(['2026-12-01']);
    });
  });

  describe('3. La contabilidad de lotes nunca bloquea la operacion', () => {
    test('si los lotes no cubren la venta, se consume lo que hay y se informa el faltante', () => {
      lotes.registrar(TENANT, PRODUCTO, 5, '2026-10-25');

      const r = lotes.consumirFefo(TENANT, PRODUCTO, 12);

      // La venta de 12 unidades se registra igual: el stock del producto es la verdad
      expect(r.consumido).toBe(5);
      expect(r.sinRespaldo).toBe(7);
    });

    test('un producto sin ningun lote no impide vender', () => {
      const r = lotes.consumirFefo(TENANT, PRODUCTO, 3);

      expect(r.consumido).toBe(0);
      expect(r.sinRespaldo).toBe(3);
      expect(r.detalle).toEqual([]);
    });

    test('ningun lote queda con cantidad negativa', () => {
      lotes.registrar(TENANT, PRODUCTO, 5, '2026-10-25');
      lotes.consumirFefo(TENANT, PRODUCTO, 50);

      const fila = defaultSqliteClient.queryOne<{ minimo: number }>(
        'SELECT MIN(cantidad) AS minimo FROM lotes WHERE producto_id = ?',
        [PRODUCTO]
      );
      // La restriccion CHECK (cantidad >= 0) de la tabla lo respalda ademas
      expect(Number(fila?.minimo)).toBeGreaterThanOrEqual(0);
    });

    test('agotar todos los lotes no borra la fecha del producto', () => {
      lotes.registrar(TENANT, PRODUCTO, 5, '2026-10-25');
      lotes.consumirFefo(TENANT, PRODUCTO, 5);

      // Puede quedar existencia anterior a la gestion por lote: apagar la alerta seria peor
      expect(fechaProducto()).toBe('2026-10-25');
    });
  });

  describe('4. Unidades por vencer para el panel', () => {
    test('suma solo los lotes vivos del tenant', () => {
      lotes.registrar(TENANT, PRODUCTO, 10, '2026-10-25');
      lotes.registrar(TENANT, PRODUCTO, 20, '2026-12-01');
      lotes.consumirFefo(TENANT, PRODUCTO, 4);

      expect(lotes.unidadesPorProducto(TENANT).get(PRODUCTO)).toBe(26);
    });

    test('un producto sin lotes no aparece en el mapa', () => {
      // El panel lo distingue de "cero unidades": sabe la fecha pero no la cantidad
      expect(lotes.unidadesPorProducto(TENANT).has(PRODUCTO)).toBe(false);
    });
  });
});

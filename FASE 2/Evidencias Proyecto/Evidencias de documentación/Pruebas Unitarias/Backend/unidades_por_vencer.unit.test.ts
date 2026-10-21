import { defaultSqliteClient } from '../../backend/src/database/sqlite/client';
import { initializeDatabase } from '../../backend/src/database/init-db';
import { defaultPgClient } from '../../backend/src/database/postgres/client';
import { LotesService } from '../../backend/src/inventory/lotes.service';

const TENANT = '00000000-0000-0000-0000-000000000001';
const CON_LOTES = '00000000-0000-0000-0000-00000000uni1';
const SIN_STOCK = '00000000-0000-0000-0000-00000000uni2';
const SIN_DETALLE = '00000000-0000-0000-0000-00000000uni3';

/**
 * El panel de vencimientos informa `unidades_por_vencer`, y hay TRES situaciones que no deben
 * confundirse entre si:
 *
 *   con lotes            se informa la suma de los lotes vivos
 *   sin lotes, stock 0   se informa 0, porque la cantidad SI se conoce
 *   sin lotes, con stock se informa null: se conoce la fecha, no cuanto vence en ella
 *
 * La version original devolvia null en los dos ultimos casos. Un producto agotado aparecia como
 * «sin detalle de lote», dandole aire de incognita a un dato que el sistema conoce perfectamente,
 * y ademas inflaba el contador `productos_sin_detalle_de_lote`, que promete algo distinto.
 */

/** Replica la regla del endpoint para poder fijarla sin levantar el servidor. */
function unidadesPorVencer(
  productoId: string,
  stockActual: number,
  unidadesPorLote: Map<string, number>
): number | null {
  if (unidadesPorLote.has(productoId)) return Number(unidadesPorLote.get(productoId));
  if (Number(stockActual) === 0) return 0;
  return null;
}

describe('Pruebas Unitarias: Unidades por Vencer, Cero Conocido y Cantidad Desconocida', () => {
  const lotes = new LotesService(defaultSqliteClient);

  beforeAll(async () => {
    defaultPgClient.tripCircuit();
    await initializeDatabase();
  });

  beforeEach(() => {
    for (const id of [CON_LOTES, SIN_STOCK, SIN_DETALLE]) {
      defaultSqliteClient.execute('DELETE FROM lotes WHERE producto_id = ?', [id]);
      defaultSqliteClient.execute('DELETE FROM productos WHERE id = ?', [id]);
    }

    const crear = (id: string, sku: string, stock: number) =>
      defaultSqliteClient.execute(
        `INSERT INTO productos (id, tenant_id, sku, nombre, stock_actual, precio_compra, precio_venta, activo, fecha_vencimiento)
         VALUES (?, ?, ?, 'Producto de prueba', ?, 700, 990, 1, '2026-11-30')`,
        [id, TENANT, sku, stock]
      );

    crear(CON_LOTES, 'SKU-UNI-01', 30);
    crear(SIN_STOCK, 'SKU-UNI-02', 0);
    crear(SIN_DETALLE, 'SKU-UNI-03', 12);

    lotes.registrar(TENANT, CON_LOTES, 30, '2026-11-30', 'L-NOV');
  });

  afterAll(() => {
    for (const id of [CON_LOTES, SIN_STOCK, SIN_DETALLE]) {
      defaultSqliteClient.execute('DELETE FROM lotes WHERE producto_id = ?', [id]);
      defaultSqliteClient.execute('DELETE FROM productos WHERE id = ?', [id]);
    }
  });

  test('1. Con lotes se informa la suma de lo que vence', () => {
    const mapa = lotes.unidadesPorProducto(TENANT);

    expect(unidadesPorVencer(CON_LOTES, 30, mapa)).toBe(30);
  });

  test('2. Sin lotes y sin stock se informa cero, no desconocido', () => {
    const mapa = lotes.unidadesPorProducto(TENANT);

    // El caso que reporto el equipo de interfaz: el sistema sabe que no queda nada
    expect(unidadesPorVencer(SIN_STOCK, 0, mapa)).toBe(0);
    expect(unidadesPorVencer(SIN_STOCK, 0, mapa)).not.toBeNull();
  });

  test('3. Sin lotes pero con existencia, la cantidad si es desconocida', () => {
    const mapa = lotes.unidadesPorProducto(TENANT);

    // Existencia anterior a la gestion por lote: se conoce la fecha, no cuanto vence en ella
    expect(unidadesPorVencer(SIN_DETALLE, 12, mapa)).toBeNull();
  });

  test('4. El contador de productos sin detalle cuenta solo el caso verdadero', () => {
    const mapa = lotes.unidadesPorProducto(TENANT);
    const filas = [
      { id: CON_LOTES, stock: 30 },
      { id: SIN_STOCK, stock: 0 },
      { id: SIN_DETALLE, stock: 12 }
    ].map((p) => unidadesPorVencer(p.id, p.stock, mapa));

    // De tres productos, uno solo carece de detalle: antes se contaban dos
    expect(filas.filter((u) => u === null)).toHaveLength(1);
  });

  test('5. Agotar los lotes informa cero, porque el stock tambien queda en cero', () => {
    lotes.consumirFefo(TENANT, CON_LOTES, 30);
    defaultSqliteClient.execute('UPDATE productos SET stock_actual = 0 WHERE id = ?', [CON_LOTES]);

    const mapa = lotes.unidadesPorProducto(TENANT);

    expect(unidadesPorVencer(CON_LOTES, 0, mapa)).toBe(0);
  });
});

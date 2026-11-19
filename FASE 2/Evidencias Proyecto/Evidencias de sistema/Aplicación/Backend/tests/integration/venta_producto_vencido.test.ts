import http from 'http';
import app from '../../src/index';
import { initializeDatabase } from '../../src/database/init-db';
import { defaultSqliteClient } from '../../src/database/sqlite/client';
import { defaultLotesService } from '../../src/inventory/lotes.service';
import { reloj } from '../../src/inventory/vencimiento';
import { logger } from '../../src/utils/logger';

const TENANT = '00000000-0000-0000-0000-000000000001';
const USUARIO = '00000000-0000-0000-0000-000000000002';

/** Fecha local a tantos dias de hoy: con toISOString, de noche, saldria la de mañana. */
function fecha(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * D.S. 977/96: la caja no bloquea la venta de un producto vencido, pero la venta lo deja dicho. Y el
 * semaforo del inventario cuenta los dias en la fecha del equipo, no en la hora UTC de la base.
 */
describe('La caja ante un producto vencido', () => {
  let servidor: http.Server;
  let base: string;
  let correlativo = 0;

  /** Producto con stock y, si se piden, sus lotes. Sin lotes es la existencia anterior a la gestion por lote. */
  const producto = (nombre: string, stock: number, fechaProducto: string | null, lotes: Array<[number, string]> = []) => {
    correlativo += 1;
    const id = `bbbbbbbb-0000-4000-8000-${String(Date.now()).slice(-8)}${String(correlativo).padStart(4, '0')}`;
    defaultSqliteClient.execute(
      `INSERT INTO productos (id, tenant_id, sku, nombre, stock_actual, stock_minimo, precio_compra, precio_venta, activo, fecha_vencimiento)
       VALUES (?, ?, ?, ?, ?, 1, 500, 1000, 1, ?)`,
      [id, TENANT, `VENC-CAJA-${id.slice(-12)}`, nombre, stock, fechaProducto]
    );
    for (const [cantidad, vence] of lotes) {
      defaultLotesService.registrar(TENANT, id, cantidad, vence);
    }
    return id;
  };

  /** Alta por la ruta, como la hace la pantalla de Inventario: guarda la fecha y no registra lote. */
  const alta = async (cuerpo: Record<string, unknown>) => {
    correlativo += 1;
    const res = await fetch(`${base}/api/v1/pos/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: TENANT, sku: `VENC-ALTA-${Date.now()}-${correlativo}`, precio_venta: 1000, ...cuerpo })
    });
    return { status: res.status, json: (await res.json()) as any };
  };
  const fechaGuardada = (id: string) =>
    defaultSqliteClient.queryOne<{ f: string | null }>('SELECT fecha_vencimiento AS f FROM productos WHERE id = ?', [id])?.f;

  const vender = async (items: Array<{ producto_id: string; cantidad: number }>) => {
    const res = await fetch(`${base}/api/v1/pos/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: TENANT, usuario_id: USUARIO, metodo_pago: 'EFECTIVO', items })
    });
    return { status: res.status, json: (await res.json()) as any };
  };

  beforeAll(async () => {
    await initializeDatabase();
    await new Promise<void>((listo) => {
      servidor = app.listen(0, () => {
        base = `http://127.0.0.1:${(servidor.address() as any).port}`;
        listo();
      });
    });
    // la caja no vende con el turno cerrado; si ya habia uno abierto, sirve igual
    await fetch(`${base}/api/v1/caja/abrir`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: TENANT, usuario_id: USUARIO, monto_apertura: 20000 })
    });
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    await new Promise((listo) => servidor.close(listo));
  });

  test('vende igual un lote vencido, y la respuesta nombra el producto y cuanto salio', async () => {
    const id = producto('Yogur vencido', 5, fecha(-3), [[5, fecha(-3)]]);
    const aviso = jest.spyOn(logger, 'warn');

    const res = await vender([{ producto_id: id, cantidad: 2 }]);

    const vencidos = [{ producto_id: id, nombre: 'Yogur vencido', fecha_vencimiento: fecha(-3), cantidad: 2 }];
    expect(res.status).toBe(201);
    expect(res.json.data.productos_vencidos).toEqual(vencidos);
    // es la unica constancia de que se vendio un vencido
    expect(aviso).toHaveBeenCalledWith(
      'PosRoutes',
      expect.stringContaining(`La venta ${res.json.data.saleId} incluyo productos vencidos`),
      { productos_vencidos: vencidos }
    );
    aviso.mockRestore();
  });

  test('si la venta toma de un lote vencido y de uno vigente, informa solo la parte vencida', async () => {
    const id = producto('Leche de dos lotes', 6, fecha(-1), [[1, fecha(-1)], [5, fecha(40)]]);

    const res = await vender([{ producto_id: id, cantidad: 3 }]);

    expect(res.status).toBe(201);
    expect(res.json.data.productos_vencidos).toEqual([
      { producto_id: id, nombre: 'Leche de dos lotes', fecha_vencimiento: fecha(-1), cantidad: 1 }
    ]);
  });

  test('un producto sin lotes se juzga por su propia fecha, aunque venga guardada con hora', async () => {
    const id = producto('Queso sin lote', 4, `${fecha(-10)} 00:00:00`);

    const res = await vender([{ producto_id: id, cantidad: 2 }]);

    expect(res.status).toBe(201);
    expect(res.json.data.productos_vencidos).toEqual([
      { producto_id: id, nombre: 'Queso sin lote', fecha_vencimiento: fecha(-10), cantidad: 2 }
    ]);
  });

  test('un producto dado de alta por la ruta, sin lotes, se juzga por la fecha con que se guardo', async () => {
    const creado = await alta({ nombre: 'Mantequilla dada de alta', stock_actual: 3, fecha_vencimiento: fecha(-4) });
    expect(creado.status).toBe(201);
    const id = creado.json.data.id;

    const res = await vender([{ producto_id: id, cantidad: 2 }]);

    expect(res.status).toBe(201);
    expect(res.json.data.productos_vencidos).toEqual([
      { producto_id: id, nombre: 'Mantequilla dada de alta', fecha_vencimiento: fecha(-4), cantidad: 2 }
    ]);
  });

  test('partir el mismo producto en dos lineas no cambia cuantas unidades vencidas se informan', async () => {
    // cinco en stock, un lote vencido y uno vigente que respaldan una unidad cada uno
    const lotes: Array<[number, string]> = [[1, fecha(-5)], [1, fecha(40)]];
    const enUnaLinea = producto('Cecina en una linea', 5, fecha(-5), lotes);
    const enDosLineas = producto('Cecina en dos lineas', 5, fecha(-5), lotes);

    const una = await vender([{ producto_id: enUnaLinea, cantidad: 5 }]);
    const dos = await vender([{ producto_id: enDosLineas, cantidad: 1 }, { producto_id: enDosLineas, cantidad: 4 }]);

    // una del lote vencido y las tres que ningun lote respalda, por la fecha que tenia el producto
    expect(una.json.data.productos_vencidos[0].cantidad).toBe(4);
    expect(dos.json.data.productos_vencidos[0].cantidad).toBe(4);
  });

  test('lo que el lote no respalda se suma con la fecha que tenia el producto antes de vender', async () => {
    // tres unidades en stock y un lote vencido que solo respalda una
    const id = producto('Jamon con stock sin respaldo', 3, fecha(-2), [[1, fecha(-2)]]);

    const res = await vender([{ producto_id: id, cantidad: 3 }]);

    expect(res.json.data.productos_vencidos).toEqual([
      { producto_id: id, nombre: 'Jamon con stock sin respaldo', fecha_vencimiento: fecha(-2), cantidad: 3 }
    ]);
  });

  test('el mismo producto en dos lineas sale una sola vez, con la fecha mas antigua y la cantidad sumada', async () => {
    const id = producto('Pan en dos lineas', 4, fecha(-5), [[1, fecha(-5)], [3, fecha(-2)]]);

    const res = await vender([{ producto_id: id, cantidad: 1 }, { producto_id: id, cantidad: 2 }]);

    expect(res.status).toBe(201);
    expect(res.json.data.productos_vencidos).toEqual([
      { producto_id: id, nombre: 'Pan en dos lineas', fecha_vencimiento: fecha(-5), cantidad: 3 }
    ]);
  });

  test('lo vigente, lo que vence hoy, lo que no tiene fecha y una fecha ilegible no se informan', async () => {
    const items = [
      producto('Arroz vigente', 2, fecha(60), [[2, fecha(60)]]),
      producto('Pan que vence hoy', 2, fecha(0), [[2, fecha(0)]]),
      producto('Bolsa sin fecha', 2, null),
      producto('Fecha ilegible', 2, 'pronto')
    ].map((producto_id) => ({ producto_id, cantidad: 1 }));

    const res = await vender(items);

    expect(res.status).toBe(201);
    expect(res.json.data.productos_vencidos).toEqual([]);
  });

  test('el semaforo cuenta los dias con el reloj del equipo, tambien de noche', async () => {
    // otro dia y casi medianoche: con la hora UTC de la base el resultado seria otro
    jest.spyOn(reloj, 'ahora').mockReturnValue(new Date(2031, 5, 15, 23, 30));
    const hoy = producto('Vence el dia del reloj', 2, '2031-06-15');
    const ayer = producto('Vencio el dia anterior', 2, '2031-06-14');
    const ilegible = producto('Semaforo con fecha ilegible', 2, 'pronto');

    const res = await fetch(`${base}/api/v1/pos/vencimientos?tenant_id=${TENANT}`);
    const filas = ((await res.json()) as any).data as any[];
    const de = (id: string) => filas.find((f) => f.id === id);

    expect(de(hoy)).toMatchObject({ dias_restantes: 0, estado: 'VENCE_ESTA_SEMANA' });
    expect(de(ayer)).toMatchObject({ dias_restantes: -1, estado: 'VENCIDO' });
    // lo que no se puede leer queda a la vista como urgente, nunca como vigente
    expect(de(ilegible)).toMatchObject({ dias_restantes: 0, estado: 'VENCE_ESTA_SEMANA' });
  });

  describe('una fecha de vencimiento ilegible no se guarda', () => {
    test('el alta la rechaza, y guarda por su dia la que viene con hora', async () => {
      const ilegible = await alta({ nombre: 'Fecha mal escrita', fecha_vencimiento: '18/11/2025' });
      expect(ilegible.status).toBe(400);
      expect(ilegible.json.message).toMatch(/AAAA-MM-DD/);

      const conHora = await alta({ nombre: 'Fecha con hora', fecha_vencimiento: `${fecha(20)}T03:00:00.000Z` });
      expect(conHora.status).toBe(201);
      expect(fechaGuardada(conHora.json.data.id)).toBe(fecha(20));

      const sinFecha = await alta({ nombre: 'Sin fecha', fecha_vencimiento: '' });
      expect(sinFecha.status).toBe(201);
      expect(fechaGuardada(sinFecha.json.data.id)).toBeNull();
    });

    test('la edicion la rechaza y deja la fecha que habia', async () => {
      const id = producto('Producto que se edita', 2, fecha(30));
      const editar = (cuerpo: Record<string, unknown>) =>
        fetch(`${base}/api/v1/pos/products/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenant_id: TENANT, ...cuerpo })
        });

      expect((await editar({ fecha_vencimiento: 'pronto' })).status).toBe(400);
      expect(fechaGuardada(id)).toBe(fecha(30));

      expect((await editar({ fecha_vencimiento: fecha(45) })).status).toBe(200);
      expect(fechaGuardada(id)).toBe(fecha(45));

      // editar otro dato sin mandar la fecha no la toca
      expect((await editar({ stock_minimo: 3 })).status).toBe(200);
      expect(fechaGuardada(id)).toBe(fecha(45));
    });
  });
});

import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import app from '../../src/index';
import { initializeDatabase } from '../../src/database/init-db';
import { defaultSqliteClient } from '../../src/database/sqlite/client';
import { defaultPgClient } from '../../src/database/postgres/client';
import { InvoiceFileStore } from '../../src/invoices/invoice-file.store';
import {
  InvoiceIngestionService,
  VencimientoRequeridoError,
  defaultInvoiceIngestionService
} from '../../src/invoices/invoice-ingestion.service';
import { ESTADO_PENDIENTE, ticketsEnConfirmacion } from '../../src/invoices/estados-cola';
import { defaultF29ReportService } from '../../src/dte/f29-report.service';
import { mesLocal } from '../../src/utils/fecha-local';
import { defaultTenantConfigService } from '../../src/config/tenant-config.service';
import {
  ESTADO_FALLIDA,
  ESTADO_POR_REVISAR,
  InvoiceQueueService,
  defaultInvoiceQueue
} from '../../src/invoices/invoice-queue.service';
import { armarAlertaVencimiento, itemsSinVencimientoDeclarado } from '../../src/inventory/vencimiento';
import { OcrDispatcherService } from '../../src/ocr/ocr-dispatcher.service';
import { IOcrProvider } from '../../src/ocr/ocr-provider.interface';
import { ExtractedInvoiceData, ExtractedInvoiceItem } from '../../src/ocr/types';

const TENANT = '00000000-0000-0000-0000-000000000001';

/** Fecha local a tantos dias de hoy, para que la prueba no dependa del dia en que corre. */
function fecha(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

let correlativo = 0;
function factura(items: Array<Partial<ExtractedInvoiceItem> & { descripcion: string }>): ExtractedInvoiceData {
  correlativo += 1;
  return {
    folio_factura: `VENC-${Date.now()}-${correlativo}`,
    rut_proveedor: '76.555.001-9',
    razon_social: 'Proveedor De Vencimientos SpA',
    fecha_emision: fecha(0),
    items: items.map((item, i) => ({
      sku: `VENC-SKU-${correlativo}-${i}`,
      cantidad: 6,
      precio_unitario: 1000,
      subtotal: 6000,
      ...item
    })),
    total: 7140 * items.length,
    metodo_ingreso: 'TEST'
  };
}

describe('Vencimiento obligatorio al ingresar una factura (D.S. 977/96)', () => {
  let servidor: http.Server;
  let base: string;

  const confirmar = async (datos: ExtractedInvoiceData, extra: Record<string, unknown> = {}) => {
    const respuesta = await fetch(`${base}/api/v1/invoices/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: TENANT, invoice_data: datos, ...extra })
    });
    return { status: respuesta.status, data: (await respuesta.json()) as any };
  };

  const existeProducto = (sku: string) =>
    Boolean(defaultSqliteClient.queryOne('SELECT 1 FROM productos WHERE tenant_id = ? AND sku = ?', [TENANT, sku]));

  beforeAll(async () => {
    defaultPgClient.tripCircuit();
    await initializeDatabase();
    await new Promise<void>((listo) => {
      servidor = app.listen(0, () => {
        base = `http://127.0.0.1:${(servidor.address() as any).port}`;
        listo();
      });
    });
  });

  afterAll((done) => {
    servidor.close(done);
  });

  describe('la regla, sin base de datos', () => {
    test('falta cuando no hay fecha valida ni marca, y tambien cuando vienen las dos', () => {
      const faltan = itemsSinVencimientoDeclarado([
        { descripcion: 'sin nada' },
        { descripcion: 'fecha con barras', fecha_vencimiento: '31/12/2026' },
        { descripcion: 'dia que no existe', fecha_vencimiento: '2026-02-30' },
        { descripcion: 'fecha y marca', fecha_vencimiento: '2026-12-31', no_vence: true },
        { descripcion: 'con fecha', fecha_vencimiento: '2026-12-31' },
        { descripcion: 'no vence', no_vence: true }
      ]);
      expect(faltan).toEqual(['sin nada', 'fecha con barras', 'dia que no existe', 'fecha y marca']);
    });

    test('lo que vence hoy esta por vencer, no vencido; a dieciseis dias ya no se avisa', () => {
      const hoy = new Date(2026, 10, 19, 23, 50);
      const alerta = armarAlertaVencimiento(
        [
          { descripcion: 'ayer', cantidad: 2, fecha_vencimiento: '2026-11-18' },
          { descripcion: 'hoy', cantidad: 2, fecha_vencimiento: '2026-11-19' },
          { descripcion: 'quince', cantidad: 2, fecha_vencimiento: '2026-12-04' },
          { descripcion: 'dieciseis', cantidad: 2, fecha_vencimiento: '2026-12-05' },
          { descripcion: 'no vence', cantidad: 2, no_vence: true }
        ],
        hoy
      );
      expect(alerta.vencidos.map((v) => v.descripcion)).toEqual(['ayer']);
      expect(alerta.vencidos[0].dias_restantes).toBe(-1);
      expect(alerta.por_vencer.map((v) => v.descripcion)).toEqual(['hoy', 'quince']);
    });
  });

  describe('POST /invoices/confirm', () => {
    test('sin fecha ni marca responde 400, nombra el producto y no ingresa nada', async () => {
      const datos = factura([
        { descripcion: 'Yogur sin fecha' },
        { descripcion: 'Leche con fecha', fecha_vencimiento: fecha(60) }
      ]);
      const r = await confirmar(datos);

      expect(r.status).toBe(400);
      expect(r.data.code).toBe('VENCIMIENTO_REQUERIDO');
      expect(r.data.productos).toEqual(['Yogur sin fecha']);
      expect(existeProducto(String(datos.items[0].sku))).toBe(false);
      expect(existeProducto(String(datos.items[1].sku))).toBe(false);
    });

    test('rechaza una fecha mal escrita y una fecha junto con la marca', async () => {
      expect((await confirmar(factura([{ descripcion: 'Con barras', fecha_vencimiento: '31/12/2026' }]))).status).toBe(400);
      expect(
        (await confirmar(factura([{ descripcion: 'Las dos', fecha_vencimiento: fecha(30), no_vence: true }]))).status
      ).toBe(400);
    });

    test('con la marca de que no vence ingresa, sin lote y sin alerta', async () => {
      const datos = factura([{ descripcion: 'Bolsa reutilizable', no_vence: true }]);
      const r = await confirmar(datos);

      expect(r.status).toBe(200);
      expect(r.data.data.alerta_vencimiento).toEqual({ vencidos: [], por_vencer: [] });
      const producto = defaultSqliteClient.queryOne<{ id: string; fecha_vencimiento: string | null }>(
        'SELECT id, fecha_vencimiento FROM productos WHERE tenant_id = ? AND sku = ?',
        [TENANT, datos.items[0].sku]
      );
      expect(producto?.fecha_vencimiento ?? null).toBeNull();
      const lotes = defaultSqliteClient.queryOne<{ total: number }>(
        'SELECT COUNT(*) AS total FROM lotes WHERE producto_id = ?',
        [producto?.id]
      );
      expect(Number(lotes?.total)).toBe(0);
    });

    test('un producto vencido ingresa igual y la respuesta lo nombra aparte de los que vencen pronto', async () => {
      const datos = factura([
        { descripcion: 'Queso vencido', fecha_vencimiento: fecha(-3) },
        { descripcion: 'Pan que vence hoy', fecha_vencimiento: fecha(0) },
        { descripcion: 'Jamon a diez dias', fecha_vencimiento: fecha(10) },
        { descripcion: 'Arroz lejano', fecha_vencimiento: fecha(200) }
      ]);
      const r = await confirmar(datos);

      expect(r.status).toBe(200);
      const alerta = r.data.data.alerta_vencimiento;
      expect(alerta.vencidos.map((v: any) => v.descripcion)).toEqual(['Queso vencido']);
      expect(alerta.vencidos[0].dias_restantes).toBe(-3);
      expect(alerta.por_vencer.map((v: any) => v.descripcion)).toEqual(['Pan que vence hoy', 'Jamon a diez dias']);
      // se avisa, no se bloquea: el vencido quedo en el stock
      expect(existeProducto(String(datos.items[0].sku))).toBe(true);
    });
  });

  describe('la cola de pendientes ya no ingresa por su cuenta', () => {
    const leida = factura([{ descripcion: 'Helado de la cola' }]);
    const motor: IOcrProvider = {
      name: 'MotorQueLee',
      async extractInvoiceData(): Promise<ExtractedInvoiceData> {
        return JSON.parse(JSON.stringify(leida));
      }
    };
    const sinProductos: IOcrProvider = {
      name: 'MotorSinProductos',
      async extractInvoiceData(): Promise<ExtractedInvoiceData> {
        return { ...JSON.parse(JSON.stringify(leida)), items: [] };
      }
    };

    let directorio: string;
    let store: InvoiceFileStore;
    let ingestion: InvoiceIngestionService;
    let cola: InvoiceQueueService;

    beforeAll(() => {
      directorio = fs.mkdtempSync(path.join(os.tmpdir(), 'gestock-venc-'));
      store = new InvoiceFileStore(directorio, 10);
      ingestion = new InvoiceIngestionService(undefined, new OcrDispatcherService(motor, motor), store);
      cola = new InvoiceQueueService(defaultSqliteClient, store, ingestion, 3);
    });

    afterAll(() => {
      fs.rmSync(directorio, { recursive: true, force: true });
    });

    afterEach(() => {
      defaultSqliteClient.execute(
        "DELETE FROM factura_ingresos WHERE tenant_id = ? AND estado IN ('PENDIENTE_OCR', 'FALLIDA_OCR', 'POR_REVISAR')",
        [TENANT]
      );
    });

    test('lee la factura, la deja por revisar y no toca el stock ni el historial', async () => {
      const ticket = cola.encolar(TENANT, Buffer.from('foto').toString('base64'), 'cola.jpg', 'image/jpeg');

      const r = await cola.procesarPendientes(TENANT);

      expect(r.por_revisar).toBe(1);
      const enCola = cola.listar(TENANT);
      expect(enCola).toHaveLength(1);
      expect(enCola[0].estado).toBe(ESTADO_POR_REVISAR);
      // el numero provisional no cambia: la factura real no puede chocar con su propio ticket
      expect(enCola[0].numero_factura).toBe(ticket.numero_factura);
      expect(existeProducto(String(leida.items[0].sku))).toBe(false);
      const historial = await ingestion.getInvoices(TENANT);
      expect(historial.some((f) => f.id === ticket.id)).toBe(false);
      // la lectura no guardo una segunda copia del documento
      expect(store.inventariar(TENANT)).toHaveLength(1);
    });

    test('al revisarla y confirmarla ingresa con el documento del ticket, y el ticket se retira', async () => {
      const ticket = cola.encolar(TENANT, Buffer.from('foto').toString('base64'), 'cola.jpg', 'image/jpeg');
      await cola.procesarPendientes(TENANT);

      const vista = await cola.abrirParaRevision(TENANT, ticket.id);
      expect(vista?.items).toHaveLength(1);
      const documento = cola.documentoDelTicket(TENANT, ticket.id);
      expect(vista?.documento).toEqual(documento);

      // sin declarar el vencimiento sigue sin poder ingresar, y el ticket se conserva
      await expect(ingestion.confirmIngest(TENANT, vista!.raw_data, documento!, ticket.id)).rejects.toThrow(/vencimiento/);
      expect(cola.listar(TENANT)).toHaveLength(1);

      const revisada = { ...vista!.raw_data, items: vista!.raw_data.items.map((i) => ({ ...i, fecha_vencimiento: fecha(90) })) };
      const resultado = await ingestion.confirmIngest(TENANT, revisada, documento!, ticket.id);

      expect(cola.listar(TENANT)).toHaveLength(0);
      expect(existeProducto(String(leida.items[0].sku))).toBe(true);
      const ingresada = defaultSqliteClient.queryOne<{ archivo_ruta: string }>(
        'SELECT archivo_ruta FROM factura_ingresos WHERE id = ?',
        [resultado.invoice_id]
      );
      expect(ingresada?.archivo_ruta).toBe(documento!.ruta);
      expect(await cola.abrirParaRevision(TENANT, ticket.id)).toBeNull();
    });

    test('una lectura sin productos queda como fallida, no por revisar', async () => {
      const otra = new InvoiceQueueService(
        defaultSqliteClient,
        store,
        new InvoiceIngestionService(undefined, new OcrDispatcherService(sinProductos, sinProductos), store),
        3
      );
      otra.encolar(TENANT, Buffer.from('foto').toString('base64'), 'vacia.jpg', 'image/jpeg');

      const r = await otra.procesarPendientes(TENANT);

      expect(r.por_revisar).toBe(0);
      expect(otra.listar(TENANT)[0].estado).toBe(ESTADO_FALLIDA);
    });

    test('una factura por revisar se puede descartar, una sola vez', async () => {
      const ticket = cola.encolar(TENANT, Buffer.from('foto').toString('base64'), 'cola.jpg', 'image/jpeg');
      await cola.procesarPendientes(TENANT);

      expect(cola.descartar(TENANT, ticket.id)).toBe(true);
      expect(cola.descartar(TENANT, ticket.id)).toBe(false);
      expect(cola.listar(TENANT)).toHaveLength(0);
    });

    test('las rutas abren, confirman y descartan solo tickets que existen', async () => {
      const ticket = defaultInvoiceQueue.encolar(TENANT, Buffer.from('foto').toString('base64'), 'ruta.jpg', 'image/jpeg');
      defaultSqliteClient.execute(
        'UPDATE factura_ingresos SET estado = ?, json_ocr_raw = ? WHERE id = ?',
        [ESTADO_POR_REVISAR, JSON.stringify(leida), ticket.id]
      );

      const vista = await fetch(`${base}/api/v1/invoices/pending/${ticket.id}/preview?tenant_id=${TENANT}`);
      expect(vista.status).toBe(200);
      expect(((await vista.json()) as any).data.items).toHaveLength(1);

      const inexistente = await confirmar(factura([{ descripcion: 'x', no_vence: true }]), { cola_id: 'no-existe' });
      expect(inexistente.status).toBe(404);

      const borrar = () =>
        fetch(`${base}/api/v1/invoices/pending/${ticket.id}?tenant_id=${TENANT}`, { method: 'DELETE' });
      expect((await borrar()).status).toBe(200);
      expect((await borrar()).status).toBe(404);
    });

    /** Ticket de la cola por defecto, la que usan las rutas, ya leido y esperando revision. */
    const ticketPorRevisar = (tenant = TENANT) => {
      const ticket = defaultInvoiceQueue.encolar(tenant, Buffer.from('foto').toString('base64'), 'ruta.jpg', 'image/jpeg');
      defaultSqliteClient.execute(
        'UPDATE factura_ingresos SET estado = ?, json_ocr_raw = ? WHERE id = ?',
        [ESTADO_POR_REVISAR, JSON.stringify(leida), ticket.id]
      );
      return ticket;
    };
    const estadoDe = (id: string) =>
      defaultSqliteClient.queryOne<{ estado: string }>('SELECT estado FROM factura_ingresos WHERE id = ?', [id])?.estado;

    test('la ruta confirma con el documento del ticket, no con el que mande el cliente, y lo retira', async () => {
      const ticket = ticketPorRevisar();
      const documento = defaultInvoiceQueue.documentoDelTicket(TENANT, ticket.id);
      const datos = factura([{ descripcion: 'Helado revisado', fecha_vencimiento: fecha(90) }]);

      const r = await confirmar(datos, {
        cola_id: ticket.id,
        documento: { ruta: 'otro/que-no-es.jpg', nombre: 'ajeno.jpg', mime: 'image/jpeg' }
      });

      expect(r.status).toBe(200);
      expect(estadoDe(ticket.id)).toBeUndefined();
      const ingresada = defaultSqliteClient.queryOne<{ archivo_ruta: string }>(
        'SELECT archivo_ruta FROM factura_ingresos WHERE id = ?',
        [r.data.data.invoice_id]
      );
      expect(ingresada?.archivo_ruta).toBe(documento!.ruta);
    });

    test('un ticket de otro local no se abre, no se confirma y no se descarta', async () => {
      const ticket = ticketPorRevisar();
      const otroLocal = '00000000-0000-0000-0000-000000000002';

      expect(await defaultInvoiceQueue.abrirParaRevision(otroLocal, ticket.id)).toBeNull();
      expect(defaultInvoiceQueue.documentoDelTicket(otroLocal, ticket.id)).toBeFalsy();
      expect(defaultInvoiceQueue.descartar(otroLocal, ticket.id)).toBe(false);
      await expect(
        defaultInvoiceIngestionService.confirmIngest(otroLocal, factura([{ descripcion: 'x', no_vence: true }]), undefined, ticket.id)
      ).rejects.toThrow(/ya no esta esperando revision/);

      const pedir = (ruta: string, init?: RequestInit) => fetch(`${base}/api/v1/invoices/${ruta}`, init);
      expect((await pedir(`pending/${ticket.id}/preview?tenant_id=${otroLocal}`)).status).toBe(404);
      expect((await pedir(`pending/${ticket.id}?tenant_id=${otroLocal}`, { method: 'DELETE' })).status).toBe(404);
      const confirmacion = await pedir('confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: otroLocal, cola_id: ticket.id, invoice_data: factura([{ descripcion: 'x', no_vence: true }]) })
      });
      expect(confirmacion.status).toBe(404);
      expect(estadoDe(ticket.id)).toBe(ESTADO_POR_REVISAR);
    });

    test('un ticket que todavia no se leyo no sirve para confirmar', async () => {
      const ticket = defaultInvoiceQueue.encolar(TENANT, Buffer.from('foto').toString('base64'), 'sin-leer.jpg', 'image/jpeg');

      const r = await confirmar(factura([{ descripcion: 'x', no_vence: true }]), { cola_id: ticket.id });

      expect(r.status).toBe(404);
      expect(estadoDe(ticket.id)).toBe(ESTADO_PENDIENTE);
    });

    test('si la factura resulta duplicada el ticket se conserva', async () => {
      const datos = factura([{ descripcion: 'Helado repetido', no_vence: true }]);
      expect((await confirmar(datos)).status).toBe(200);
      const ticket = ticketPorRevisar();

      const r = await confirmar(datos, { cola_id: ticket.id });

      expect(r.status).toBe(409);
      expect(estadoDe(ticket.id)).toBe(ESTADO_POR_REVISAR);
    });

    test('dos confirmaciones a la vez del mismo ticket ingresan una sola vez', async () => {
      const ticket = ticketPorRevisar();
      const datos = factura([{ descripcion: 'Helado disputado', no_vence: true }]);
      // con la nube desconectada la confirmacion no cede el turno: se fuerza una espera real, como
      // la que produce la transaccion en la nube, para que las dos peticiones se crucen de verdad
      const espera = jest.spyOn(defaultTenantConfigService, 'getProfitMargin').mockImplementation(async () => {
        await new Promise((listo) => setTimeout(listo, 80));
        return 35;
      });

      const respuestas = await Promise.all([
        confirmar(datos, { cola_id: ticket.id }),
        confirmar(datos, { cola_id: ticket.id })
      ]);
      espera.mockRestore();

      expect(respuestas.map((r) => r.status).sort()).toEqual([200, 404]);
      const producto = defaultSqliteClient.queryOne<{ stock_actual: number }>(
        'SELECT stock_actual FROM productos WHERE tenant_id = ? AND sku = ?',
        [TENANT, datos.items[0].sku]
      );
      expect(Number(producto?.stock_actual)).toBe(6);
      expect(ticketsEnConfirmacion.size).toBe(0);
    });

    test('una confirmacion rechazada libera el ticket para volver a intentarlo', async () => {
      const ticket = ticketPorRevisar();

      const sinFecha = await confirmar(factura([{ descripcion: 'Helado sin fecha' }]), { cola_id: ticket.id });
      expect(sinFecha.status).toBe(400);
      expect(ticketsEnConfirmacion.size).toBe(0);

      const conFecha = await confirmar(factura([{ descripcion: 'Helado con fecha', fecha_vencimiento: fecha(60) }]), { cola_id: ticket.id });
      expect(conFecha.status).toBe(200);
    });

    test('un ticket que se esta confirmando no se puede confirmar otra vez ni descartar', async () => {
      const ticket = ticketPorRevisar();
      ticketsEnConfirmacion.add(ticket.id);
      try {
        const r = await confirmar(factura([{ descripcion: 'x', no_vence: true }]), { cola_id: ticket.id });
        expect(r.status).toBe(404);
        expect(defaultInvoiceQueue.descartar(TENANT, ticket.id)).toBe(false);
        const porLaRuta = await fetch(`${base}/api/v1/invoices/pending/${ticket.id}?tenant_id=${TENANT}`, { method: 'DELETE' });
        expect(porLaRuta.status).toBe(409);
        expect(estadoDe(ticket.id)).toBe(ESTADO_POR_REVISAR);
      } finally {
        ticketsEnConfirmacion.delete(ticket.id);
      }
      expect(defaultInvoiceQueue.descartar(TENANT, ticket.id)).toBe(true);
    });

    test('una pasada atrasada de la cola no saca de revision un ticket ya leido', () => {
      const ticket = ticketPorRevisar();

      (defaultInvoiceQueue as any).marcarFallida(ticket.id, 'lectura atrasada que fallo');

      expect(estadoDe(ticket.id)).toBe(ESTADO_POR_REVISAR);
    });

    /** Cola cuyo motor ve que, mientras leia, otra pasada ya dejo el ticket por revisar. */
    const colaAtrasada = (alTerminar: 'lee' | 'falla') => {
      const motorAtrasado: IOcrProvider = {
        name: 'MotorAtrasado',
        async extractInvoiceData(): Promise<ExtractedInvoiceData> {
          defaultSqliteClient.execute(
            "UPDATE factura_ingresos SET estado = ?, json_ocr_raw = 'lectura de la otra pasada' WHERE tenant_id = ? AND estado = ?",
            [ESTADO_POR_REVISAR, TENANT, ESTADO_PENDIENTE]
          );
          if (alTerminar === 'falla') throw new Error('getaddrinfo ENOTFOUND generativelanguage.googleapis.com');
          return JSON.parse(JSON.stringify(leida));
        }
      };
      return new InvoiceQueueService(
        defaultSqliteClient,
        store,
        new InvoiceIngestionService(undefined, new OcrDispatcherService(motorAtrasado, motorAtrasado), store),
        3
      );
    };
    const filaDe = (id: string) =>
      defaultSqliteClient.queryOne<{ estado: string; json_ocr_raw: string; ultimo_error: string | null }>(
        'SELECT estado, json_ocr_raw, ultimo_error FROM factura_ingresos WHERE id = ?',
        [id]
      );

    test('una lectura atrasada no pisa lo que otra pasada ya dejo por revisar, ni lo cuenta', async () => {
      const atrasada = colaAtrasada('lee');
      const ticket = atrasada.encolar(TENANT, Buffer.from('foto').toString('base64'), 'doble.jpg', 'image/jpeg');

      const r = await atrasada.procesarPendientes(TENANT);

      expect(filaDe(ticket.id)?.json_ocr_raw).toBe('lectura de la otra pasada');
      expect(r.por_revisar).toBe(0);
      expect(r.detalle).toHaveLength(0);
    });

    test('un reintento atrasado no anota su error en un ticket ya leido, ni lo cuenta como pendiente', async () => {
      const atrasada = colaAtrasada('falla');
      const ticket = atrasada.encolar(TENANT, Buffer.from('foto').toString('base64'), 'doble.jpg', 'image/jpeg');

      const r = await atrasada.procesarPendientes(TENANT);

      expect(filaDe(ticket.id)?.estado).toBe(ESTADO_POR_REVISAR);
      expect(filaDe(ticket.id)?.ultimo_error).toBeNull();
      expect(r.detalle).toHaveLength(0);
    });

    test('una factura en cola no viaja en el respaldo tributario', async () => {
      const ticket = ticketPorRevisar();

      const respaldo = await fetch(`${base}/api/v1/dte/backup/export?tenant_id=${TENANT}`);

      expect(respaldo.status).toBe(200);
      expect(await respaldo.text()).not.toContain(ticket.id);
    });

    test('una factura por revisar no cuenta como compra en el F29', () => {
      const compras = () => {
        const texto = JSON.stringify(defaultF29ReportService.generateMonthlyF29(TENANT, mesLocal()));
        return Number(/"tipoDocumento":"Facturas de Compra[^}]*?"cantidad":(\d+)/.exec(texto)?.[1]);
      };
      const antes = compras();

      ticketPorRevisar();

      expect(compras()).toBe(antes);
    });
  });

  describe('bordes de la declaracion', () => {
    test('la marca de que no vence con la fecha vacia no borra la fecha que el producto ya tenia', async () => {
      const primera = factura([{ descripcion: 'Leche con fecha', fecha_vencimiento: fecha(90) }]);
      expect((await confirmar(primera)).status).toBe(200);
      const sku = primera.items[0].sku;

      const segunda = factura([{ descripcion: 'Leche con fecha', sku, no_vence: true, fecha_vencimiento: '' }]);
      expect((await confirmar(segunda)).status).toBe(200);

      const producto = defaultSqliteClient.queryOne<{ fecha_vencimiento: string }>(
        'SELECT fecha_vencimiento FROM productos WHERE tenant_id = ? AND sku = ?',
        [TENANT, sku]
      );
      expect(producto?.fecha_vencimiento).toBe(fecha(90));
    });

    test('una marca que no es un booleano se rechaza, aunque venga con una fecha valida', async () => {
      const datos = factura([{ descripcion: 'Yogur con marca rara', fecha_vencimiento: fecha(30), no_vence: 'false' as any }]);

      const r = await confirmar(datos);

      expect(r.status).toBe(400);
      expect(r.data.code).toBe('VENCIMIENTO_REQUERIDO');
      expect(existeProducto(String(datos.items[0].sku))).toBe(false);
    });

    test('la ingesta directa responde 400 y explica el camino con /scan y /confirm', async () => {
      const espia = jest
        .spyOn(defaultInvoiceIngestionService, 'ingestInvoice')
        .mockRejectedValueOnce(new VencimientoRequeridoError(['Yogur sin fecha']));

      const respuesta = await fetch(`${base}/api/v1/invoices/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: TENANT, invoice_data: 'documento' })
      });
      const cuerpo = (await respuesta.json()) as any;
      espia.mockRestore();

      expect(respuesta.status).toBe(400);
      expect(cuerpo.code).toBe('VENCIMIENTO_REQUERIDO');
      expect(cuerpo.productos).toEqual(['Yogur sin fecha']);
      expect(cuerpo.message).toMatch(/\/scan/);
    });

    test('la ingesta directa de una lectura sin fechas no ingresa nada', async () => {
      const leidaSinFecha = factura([{ descripcion: 'Queso leido sin fecha' }]);
      const motor: IOcrProvider = {
        name: 'MotorSinFechas',
        async extractInvoiceData(): Promise<ExtractedInvoiceData> {
          return leidaSinFecha;
        }
      };
      const servicio = new InvoiceIngestionService(undefined, new OcrDispatcherService(motor, motor));

      await expect(servicio.ingestInvoice(TENANT, { invoiceData: leidaSinFecha } as any)).rejects.toBeInstanceOf(
        VencimientoRequeridoError
      );
      expect(existeProducto(String(leidaSinFecha.items[0].sku))).toBe(false);
    });
  });
});

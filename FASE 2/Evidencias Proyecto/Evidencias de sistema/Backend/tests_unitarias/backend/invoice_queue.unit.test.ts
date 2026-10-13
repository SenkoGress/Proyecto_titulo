import fs from 'fs';
import os from 'os';
import path from 'path';
import { defaultSqliteClient } from '../../backend/src/database/sqlite/client';
import { initializeDatabase } from '../../backend/src/database/init-db';
import { defaultPgClient } from '../../backend/src/database/postgres/client';
import { InvoiceFileStore } from '../../backend/src/invoices/invoice-file.store';
import {
  ESTADO_FALLIDA,
  ESTADO_PENDIENTE,
  InvoiceQueueService
} from '../../backend/src/invoices/invoice-queue.service';
import { InvoiceIngestionService } from '../../backend/src/invoices/invoice-ingestion.service';
import { IngestionResult } from '../../backend/src/invoices/invoice-ingestion.service';

const TENANT = '00000000-0000-0000-0000-000000000001';
const DOCUMENTO = Buffer.from('contenido-de-la-factura').toString('base64');

/** Ingesta simulada: permite decidir si la digitalizacion de turno funciona o falla. */
function ingestaQueResponde(respuestas: Array<'ok' | 'falla'>) {
  const usadas: string[] = [];
  const documentos: Array<{ ruta: string; nombre: string; mime: string } | undefined> = [];
  let i = 0;
  const servicio = {
    async ingestInvoice(_t: string, _input: unknown, documento?: { ruta: string; nombre: string; mime: string }): Promise<IngestionResult> {
      documentos.push(documento);
      const turno = respuestas[Math.min(i, respuestas.length - 1)];
      i += 1;
      usadas.push(turno);
      if (turno === 'falla') {
        throw new Error('No fue posible digitalizar el documento mediante IA ni extracción nativa de PDF.');
      }
      return {
        invoice_id: 'inv-generada',
        folio_factura: 'FAC-DESDE-COLA',
        proveedor_id: 'prov-1',
        rut_proveedor: '76.123.456-0',
        total: 10000,
        items_count: 1,
        used_fallback: false,
        ocr_provider: 'StubOcr',
        duration_ms: 1
      };
    }
  };
  return { servicio: servicio as unknown as InvoiceIngestionService, usadas, documentos };
}

describe('Pruebas Unitarias: Cola de Facturas Pendientes de Digitalizacion', () => {
  let directorio: string;
  let store: InvoiceFileStore;

  beforeAll(async () => {
    defaultPgClient.tripCircuit();
    await initializeDatabase();
  });

  beforeEach(() => {
    directorio = fs.mkdtempSync(path.join(os.tmpdir(), 'gestock-cola-'));
    store = new InvoiceFileStore(directorio, 10);
    defaultSqliteClient.execute('DELETE FROM factura_ingresos WHERE estado IN (?, ?)', [ESTADO_PENDIENTE, ESTADO_FALLIDA]);
  });

  afterEach(() => {
    defaultSqliteClient.execute('DELETE FROM factura_ingresos WHERE estado IN (?, ?)', [ESTADO_PENDIENTE, ESTADO_FALLIDA]);
    fs.rmSync(directorio, { recursive: true, force: true });
  });

  test('encolar guarda el documento en disco y lo deja visible como pendiente', () => {
    const cola = new InvoiceQueueService(defaultSqliteClient, store, ingestaQueResponde(['ok']).servicio, 3);

    const encolada = cola.encolar(TENANT, DOCUMENTO, 'factura_proveedor.pdf', 'application/pdf', 'foto ilegible');

    expect(encolada.numero_factura).toMatch(/^PENDIENTE-/);
    const enCola = cola.listar(TENANT);
    expect(enCola).toHaveLength(1);
    expect(enCola[0].estado).toBe(ESTADO_PENDIENTE);
    expect(enCola[0].ultimo_error).toBe('foto ilegible');
    expect(cola.contarPendientes(TENANT)).toBe(1);

    // lo esencial: el archivo sobrevive, porque sin el no habria nada que reprocesar
    const guardados = fs.readdirSync(path.join(directorio, TENANT));
    expect(guardados).toHaveLength(1);
  });

  test('procesar la cola digitaliza la factura y retira el ticket', async () => {
    const { servicio, usadas } = ingestaQueResponde(['ok']);
    const cola = new InvoiceQueueService(defaultSqliteClient, store, servicio, 3);
    cola.encolar(TENANT, DOCUMENTO, 'factura.pdf', 'application/pdf');

    const resultado = await cola.procesarPendientes(TENANT);

    expect(usadas).toEqual(['ok']);
    expect(resultado.procesadas).toBe(1);
    expect(resultado.fallidas).toBe(0);
    expect(resultado.detalle[0].folio).toBe('FAC-DESDE-COLA');
    expect(cola.listar(TENANT)).toHaveLength(0);
  });

  test('un fallo deja la factura en cola y cuenta el intento', async () => {
    const cola = new InvoiceQueueService(defaultSqliteClient, store, ingestaQueResponde(['falla']).servicio, 3);
    cola.encolar(TENANT, DOCUMENTO, 'factura.jpg', 'image/jpeg');

    const resultado = await cola.procesarPendientes(TENANT);

    expect(resultado.procesadas).toBe(0);
    expect(resultado.pendientes).toBe(1);
    const enCola = cola.listar(TENANT);
    expect(enCola[0].estado).toBe(ESTADO_PENDIENTE);
    expect(enCola[0].sync_attempts).toBe(1);
  });

  test('tras agotar los intentos pasa a FALLIDA_OCR y deja de reintentarse', async () => {
    const { servicio, usadas } = ingestaQueResponde(['falla']);
    const cola = new InvoiceQueueService(defaultSqliteClient, store, servicio, 2);
    cola.encolar(TENANT, DOCUMENTO, 'factura.jpg', 'image/jpeg');

    await cola.procesarPendientes(TENANT);
    await cola.procesarPendientes(TENANT);
    const tercera = await cola.procesarPendientes(TENANT);

    // una foto ilegible no mejora por insistir: el ciclo se detiene y corresponde ingreso manual
    expect(usadas).toHaveLength(2);
    expect(tercera.procesadas).toBe(0);
    const enCola = cola.listar(TENANT);
    expect(enCola[0].estado).toBe(ESTADO_FALLIDA);
    expect(cola.contarPendientes(TENANT)).toBe(0);
  });

  test('una factura reintentada con exito despues de fallar termina procesada', async () => {
    const { servicio } = ingestaQueResponde(['falla', 'ok']);
    const cola = new InvoiceQueueService(defaultSqliteClient, store, servicio, 3);
    cola.encolar(TENANT, DOCUMENTO, 'factura.pdf', 'application/pdf');

    const primera = await cola.procesarPendientes(TENANT);
    expect(primera.procesadas).toBe(0);

    const segunda = await cola.procesarPendientes(TENANT);
    expect(segunda.procesadas).toBe(1);
    expect(cola.listar(TENANT)).toHaveLength(0);
  });

  test('si el documento ya no esta en disco la factura se marca fallida sin reintentos ciegos', async () => {
    const cola = new InvoiceQueueService(defaultSqliteClient, store, ingestaQueResponde(['ok']).servicio, 3);
    cola.encolar(TENANT, DOCUMENTO, 'factura.pdf', 'application/pdf');
    fs.rmSync(path.join(directorio, TENANT), { recursive: true, force: true });

    const resultado = await cola.procesarPendientes(TENANT);

    expect(resultado.fallidas).toBe(1);
    expect(cola.listar(TENANT)[0].estado).toBe(ESTADO_FALLIDA);
  });

  test('al procesar la cola el documento se vincula a la factura, no queda huerfano', async () => {
    const { servicio, documentos } = ingestaQueResponde(['ok']);
    const cola = new InvoiceQueueService(defaultSqliteClient, store, servicio, 3);
    cola.encolar(TENANT, DOCUMENTO, 'factura.pdf', 'application/pdf');
    const guardado = fs.readdirSync(path.join(directorio, TENANT))[0];

    await cola.procesarPendientes(TENANT);

    // el respaldo tributario viaja a la factura resultante en lugar de perderse en disco
    expect(documentos[0]).toBeDefined();
    expect(documentos[0]!.ruta).toBe(`${TENANT}/${guardado}`);
    expect(documentos[0]!.nombre).toBe('factura.pdf');
    expect(fs.existsSync(path.join(directorio, TENANT, guardado))).toBe(true);
  });

  test('la limpieza borra documentos sin factura asociada y respeta los recientes', () => {
    const cola = new InvoiceQueueService(defaultSqliteClient, store, ingestaQueResponde(['ok']).servicio, 3);

    const huerfanoViejo = store.guardar(TENANT, DOCUMENTO, 'abandonada.pdf', 'application/pdf');
    const huerfanoNuevo = store.guardar(TENANT, DOCUMENTO, 'en_revision.pdf', 'application/pdf');
    const referenciado = store.guardar(TENANT, DOCUMENTO, 'confirmada.pdf', 'application/pdf');
    cola.encolar(TENANT, DOCUMENTO, 'en_cola.pdf', 'application/pdf');

    // se referencia uno desde una factura ya procesada
    defaultSqliteClient.execute(
      `INSERT INTO factura_ingresos (id, tenant_id, numero_factura, fecha_ingreso, estado, cantidad, total, archivo_ruta)
       VALUES ('fact-con-respaldo', ?, 'FAC-1', date('now'), 'PROCESSED', 1, 1000, ?)`,
      [TENANT, referenciado.ruta]
    );

    // se envejece solo el abandonado para que caiga fuera del margen de horas
    const antiguo = path.join(directorio, huerfanoViejo.ruta);
    const hace48h = new Date(Date.now() - 48 * 3600 * 1000);
    fs.utimesSync(antiguo, hace48h, hace48h);

    const eliminados = cola.limpiarHuerfanos(TENANT, 24);

    expect(eliminados).toBe(1);
    expect(store.existe(huerfanoViejo.ruta)).toBe(false);
    expect(store.existe(huerfanoNuevo.ruta)).toBe(true);
    expect(store.existe(referenciado.ruta)).toBe(true);

    defaultSqliteClient.execute("DELETE FROM factura_ingresos WHERE id = 'fact-con-respaldo'");
  });

  test('el almacen rechaza un documento vacio y uno que excede el maximo', () => {
    // 1 KB de tope contra un documento de 2 KB
    const limitado = new InvoiceFileStore(directorio, 1 / 1024);
    const dosKb = Buffer.alloc(2048, 0x41).toString('base64');

    expect(() => store.guardar(TENANT, '', 'vacia.pdf', 'application/pdf')).toThrow(/vacío|base64/);
    expect(() => limitado.guardar(TENANT, dosKb, 'grande.pdf', 'application/pdf')).toThrow(/máximo permitido/);
    expect(() => store.guardar(TENANT, dosKb, 'normal.pdf', 'application/pdf')).not.toThrow();
  });

  test('el almacen acepta data URL y resuelve la extension por mime', () => {
    const guardado = store.guardar(TENANT, `data:image/png;base64,${DOCUMENTO}`, 'escaneo', 'image/png');

    expect(guardado.ruta.endsWith('.png')).toBe(true);
    expect(guardado.mime).toBe('image/png');
    expect(store.existe(guardado.ruta)).toBe(true);
    expect(Buffer.from(store.leerBase64(guardado.ruta), 'base64').toString()).toBe('contenido-de-la-factura');
  });
});

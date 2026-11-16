import fs from 'fs';
import os from 'os';
import path from 'path';
import { defaultSqliteClient } from '../../backend/src/database/sqlite/client';
import { initializeDatabase } from '../../backend/src/database/init-db';
import { defaultPgClient } from '../../backend/src/database/postgres/client';
import {
  DocumentoIlegibleError,
  esDocumentoIlegible,
  extraccionUtilizable,
  normalizarFolio
} from '../../backend/src/ocr/extraccion';
import { OcrDispatcherService } from '../../backend/src/ocr/ocr-dispatcher.service';
import { IOcrProvider } from '../../backend/src/ocr/ocr-provider.interface';
import { ExtractedInvoiceData } from '../../backend/src/ocr/types';
import { InvoiceFileStore } from '../../backend/src/invoices/invoice-file.store';
import { InvoiceIngestionService } from '../../backend/src/invoices/invoice-ingestion.service';
import { ESTADO_FALLIDA, ESTADO_PENDIENTE, InvoiceQueueService } from '../../backend/src/invoices/invoice-queue.service';

const TENANT = '00000000-0000-0000-0000-000000000001';

const facturaLegible: ExtractedInvoiceData = {
  folio_factura: '11354',
  rut_proveedor: '76.998.776-5',
  razon_social: 'Distribuidora Central',
  fecha_emision: '2026-10-11',
  items: [{ descripcion: 'Bebida Cola 1.5L', cantidad: 6, precio_unitario: 850, subtotal: 5100 }],
  total: 5100,
  metodo_ingreso: 'TEST'
};

/** Gemini ante una fotografia ilegible: responde correctamente y con todos los campos en null. */
const motorQueDevuelveVacio: IOcrProvider = {
  name: 'GoogleAiGemini',
  async extractInvoiceData(): Promise<ExtractedInvoiceData> {
    return {
      folio_factura: null as unknown as string,
      rut_proveedor: null as unknown as string,
      razon_social: null as unknown as string,
      fecha_emision: null as unknown as string,
      items: [],
      total: 0,
      metodo_ingreso: 'GEMINI_VISION'
    };
  }
};

const motorCaido: IOcrProvider = {
  name: 'GoogleAiGemini',
  async extractInvoiceData(): Promise<ExtractedInvoiceData> {
    throw new Error('getaddrinfo ENOTFOUND generativelanguage.googleapis.com');
  }
};

const motorQueLee: IOcrProvider = {
  name: 'MotorQueLee',
  async extractInvoiceData(): Promise<ExtractedInvoiceData> {
    return { ...facturaLegible, folio_factura: 'FAC-11354' };
  }
};

describe('Pruebas Unitarias: Documento Ilegible y Validacion de la Extraccion', () => {
  const entorno = { ...process.env };

  beforeAll(async () => {
    defaultPgClient.tripCircuit();
    await initializeDatabase();
  });

  afterAll(() => {
    process.env = entorno;
  });

  describe('1. Criterio de extraccion utilizable', () => {
    test('rechaza la respuesta vacia con la que Gemini contesta una foto ilegible', () => {
      expect(extraccionUtilizable({
        folio_factura: null as unknown as string,
        rut_proveedor: null as unknown as string,
        razon_social: null as unknown as string,
        fecha_emision: null as unknown as string,
        items: [],
        total: 0,
        metodo_ingreso: 'GEMINI_VISION'
      })).toBe(false);
    });

    test('rechaza items de relleno sin ningun otro dato: la respuesta sigue vacia', () => {
      expect(extraccionUtilizable({
        folio_factura: null as unknown as string,
        rut_proveedor: null as unknown as string,
        razon_social: null as unknown as string,
        fecha_emision: null as unknown as string,
        items: [{ descripcion: 'sin dato', cantidad: 0, precio_unitario: 0, subtotal: 0 }],
        total: 0,
        metodo_ingreso: 'GEMINI_VISION'
      })).toBe(false);
    });

    test('acepta la factura de la que solo se leyo el encabezado', () => {
      // Una factura de papel de mala calidad puede dejar legible solo el encabezado, y con el
      // proveedor y el total el usuario ya puede completar el detalle al confirmar
      expect(extraccionUtilizable({
        folio_factura: '50001',
        rut_proveedor: '76.111.222-3',
        razon_social: 'Distribuidora de Prueba Limitada',
        fecha_emision: '2026-10-01',
        items: [],
        total: 11900,
        metodo_ingreso: 'ChileanPdfDteExtractor'
      })).toBe(true);
    });

    test('acepta la factura leida, y tambien la que solo identifica por RUT', () => {
      expect(extraccionUtilizable(facturaLegible)).toBe(true);
      expect(extraccionUtilizable({ ...facturaLegible, folio_factura: null as unknown as string })).toBe(true);
    });

    test('no revienta con nulo o indefinido', () => {
      expect(extraccionUtilizable(null)).toBe(false);
      expect(extraccionUtilizable(undefined)).toBe(false);
    });
  });

  describe('2. Folio unificado entre motores', () => {
    test('quita el prefijo que agrega el extractor nativo cuando el resto es numerico', () => {
      expect(normalizarFolio('FAC-11354')).toBe('11354');
      expect(normalizarFolio('FACTURA 11354')).toBe('11354');
      expect(normalizarFolio('N° 11354')).toBe('11354');
      expect(normalizarFolio('11354')).toBe('11354');
    });

    test('conserva intacto un folio legitimamente alfanumerico', () => {
      expect(normalizarFolio('FAC-50001-A')).toBe('FAC-50001-A');
      expect(normalizarFolio('SERIE-B-99')).toBe('SERIE-B-99');
    });

    test('un folio ausente o vacio queda en null', () => {
      expect(normalizarFolio(null)).toBeNull();
      expect(normalizarFolio('   ')).toBeNull();
    });

    test('el despachador entrega el folio ya unificado', async () => {
      process.env.ENABLE_MOCK_OCR = 'true';
      const resultado = await new OcrDispatcherService(motorQueLee, motorQueLee).processInvoice({ invoiceData: 'eA==' });

      // El motor devolvio FAC-11354 y Gemini devolveria 11354: la misma factura no debe duplicarse
      expect(resultado.data.folio_factura).toBe('11354');
    });
  });

  describe('3. El despachador distingue el documento del servicio', () => {
    beforeEach(() => {
      delete process.env.ENABLE_MOCK_OCR;
      process.env.NODE_ENV = 'test';
    });

    test('una respuesta vacia del motor es documento ilegible, no exito', async () => {
      const dispatcher = new OcrDispatcherService(motorQueDevuelveVacio, motorQueDevuelveVacio);

      await expect(dispatcher.processInvoice({ invoiceData: 'eA==', fileName: 'mala.jpg' }))
        .rejects.toThrow(DocumentoIlegibleError);
    });

    test('si no se alcanza ningun motor el error es de servicio, reintentable', async () => {
      const dispatcher = new OcrDispatcherService(motorCaido, motorCaido);

      await expect(dispatcher.processInvoice({ invoiceData: 'eA==', fileName: 'mala.jpg' }))
        .rejects.toThrow(/No fue posible digitalizar/);

      await dispatcher.processInvoice({ invoiceData: 'eA==' }).catch((e) => {
        expect(esDocumentoIlegible(e)).toBe(false);
      });
    });

    test('el simulador habilitado no encubre una extraccion inservible', async () => {
      process.env.ENABLE_MOCK_OCR = 'true';
      const dispatcher = new OcrDispatcherService(motorQueDevuelveVacio, motorQueDevuelveVacio);

      await expect(dispatcher.processInvoice({ invoiceData: 'eA==' })).rejects.toThrow(DocumentoIlegibleError);
    });
  });

  describe('4. La cola no pierde la factura ni la reintenta en vano', () => {
    let directorio: string;
    let store: InvoiceFileStore;
    let cola: InvoiceQueueService;

    beforeEach(() => {
      delete process.env.ENABLE_MOCK_OCR;
      directorio = fs.mkdtempSync(path.join(os.tmpdir(), 'gestock-ileg-'));
      store = new InvoiceFileStore(directorio, 10);
      const ingestion = new InvoiceIngestionService(
        undefined,
        new OcrDispatcherService(motorQueDevuelveVacio, motorQueDevuelveVacio),
        store
      );
      cola = new InvoiceQueueService(defaultSqliteClient, store, ingestion, 3);
      defaultSqliteClient.execute('DELETE FROM factura_ingresos WHERE estado IN (?, ?)', [ESTADO_PENDIENTE, ESTADO_FALLIDA]);
    });

    afterEach(() => {
      defaultSqliteClient.execute('DELETE FROM factura_ingresos WHERE estado IN (?, ?)', [ESTADO_PENDIENTE, ESTADO_FALLIDA]);
      fs.rmSync(directorio, { recursive: true, force: true });
    });

    test('una factura ilegible NO se declara procesada ni desaparece', async () => {
      cola.encolar(TENANT, Buffer.from('ilegible').toString('base64'), 'mala.jpg', 'image/jpeg');

      const resultado = await cola.procesarPendientes(TENANT);

      // Antes decia "procesadas: 1" y borraba el ticket sin registrar nada
      expect(resultado.procesadas).toBe(0);
      expect(resultado.fallidas).toBe(1);
      const enCola = cola.listar(TENANT);
      expect(enCola).toHaveLength(1);
      expect(enCola[0].estado).toBe(ESTADO_FALLIDA);
    });

    test('pasa a fallida en el primer intento, sin gastar los tres', async () => {
      cola.encolar(TENANT, Buffer.from('ilegible').toString('base64'), 'mala.jpg', 'image/jpeg');

      await cola.procesarPendientes(TENANT);

      // Reintentar una foto movida la deja igual de movida: se avisa de inmediato
      expect(cola.listar(TENANT)[0].sync_attempts).toBeLessThanOrEqual(1);
      expect(cola.contarPendientes(TENANT)).toBe(0);
    });

    test('el documento sigue en disco y referenciado por su factura', async () => {
      cola.encolar(TENANT, Buffer.from('ilegible').toString('base64'), 'mala.jpg', 'image/jpeg');
      await cola.procesarPendientes(TENANT);

      const fila = defaultSqliteClient.queryOne<{ archivo_ruta: string }>(
        'SELECT archivo_ruta FROM factura_ingresos WHERE tenant_id = ? AND estado = ?',
        [TENANT, ESTADO_FALLIDA]
      );
      expect(fila?.archivo_ruta).toBeTruthy();
      expect(store.existe(fila!.archivo_ruta)).toBe(true);
    });

    test('registrarIlegible deja el documento visible como fallido sin pasar por la cola', () => {
      const registrada = cola.registrarIlegible(TENANT, Buffer.from('ilegible').toString('base64'), 'foto.jpg', 'image/jpeg', 'no se leyo');

      expect(registrada.numero_factura).toMatch(/^ILEGIBLE-/);
      const enCola = cola.listar(TENANT);
      expect(enCola[0].estado).toBe(ESTADO_FALLIDA);
      expect(cola.contarPendientes(TENANT)).toBe(0);
    });
  });
});

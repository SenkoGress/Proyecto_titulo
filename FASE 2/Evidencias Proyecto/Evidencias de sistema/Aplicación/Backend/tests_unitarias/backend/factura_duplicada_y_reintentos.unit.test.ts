import fs from 'fs';
import os from 'os';
import path from 'path';
import { defaultSqliteClient } from '../../backend/src/database/sqlite/client';
import { initializeDatabase } from '../../backend/src/database/init-db';
import { defaultPgClient } from '../../backend/src/database/postgres/client';
import {
  InvoiceIngestionService,
  esFacturaDuplicada
} from '../../backend/src/invoices/invoice-ingestion.service';
import { InvoiceFileStore } from '../../backend/src/invoices/invoice-file.store';
import {
  ESTADO_FALLIDA,
  ESTADO_PENDIENTE,
  InvoiceQueueService,
  esFalloDelServicio
} from '../../backend/src/invoices/invoice-queue.service';
import { OcrDispatcherService } from '../../backend/src/ocr/ocr-dispatcher.service';
import { IOcrProvider } from '../../backend/src/ocr/ocr-provider.interface';
import { ExtractedInvoiceData } from '../../backend/src/ocr/types';

const TENANT = '00000000-0000-0000-0000-000000000001';

const factura: ExtractedInvoiceData = {
  folio_factura: '11354',
  rut_proveedor: '76.998.776-5',
  razon_social: 'Froneri Chile SpA',
  fecha_emision: '2026-10-20',
  items: [{ descripcion: 'Helado Vainilla 1L', cantidad: 10, precio_unitario: 1200, subtotal: 12000 }],
  total: 12000,
  metodo_ingreso: 'TEST'
};

const motorQueLee: IOcrProvider = {
  name: 'MotorQueLee',
  async extractInvoiceData(): Promise<ExtractedInvoiceData> {
    return { ...factura };
  }
};

const servicioCaido: IOcrProvider = {
  name: 'GoogleAiGemini',
  async extractInvoiceData(): Promise<ExtractedInvoiceData> {
    throw new Error('getaddrinfo ENOTFOUND generativelanguage.googleapis.com');
  }
};

describe('Pruebas Unitarias: Factura Duplicada y Gasto de Reintentos', () => {
  beforeAll(async () => {
    defaultPgClient.tripCircuit();
    await initializeDatabase();
  });

  afterEach(() => {
    defaultSqliteClient.execute('DELETE FROM factura_ingresos WHERE tenant_id = ?', [TENANT]);
  });

  describe('1. Una compra ya contada no se vuelve a aceptar', () => {
    const servicio = new InvoiceIngestionService(
      undefined,
      new OcrDispatcherService(motorQueLee, motorQueLee)
    );

    test('la segunda ingesta del mismo folio y proveedor se rechaza', async () => {
      await servicio.confirmIngest(TENANT, factura);

      // Antes se aceptaba y el stock subia otra vez por una compra ya registrada
      await expect(servicio.confirmIngest(TENANT, factura)).rejects.toThrow(/ya fue ingresada/i);
    });

    test('el rechazo se reconoce como duplicado, no como fallo del sistema', async () => {
      await servicio.confirmIngest(TENANT, factura);

      await servicio.confirmIngest(TENANT, factura).catch((e) => {
        expect(esFacturaDuplicada(e)).toBe(true);
        expect(String(e.message)).toMatch(/Froneri Chile SpA/);
      });
    });

    test('el mismo folio de otro proveedor si se acepta', async () => {
      await servicio.confirmIngest(TENANT, factura);

      // Dos proveedores pueden emitir el mismo numero: son facturas distintas
      const otra = { ...factura, rut_proveedor: '77.111.222-3', razon_social: 'Distribuidora Austral' };
      await expect(servicio.confirmIngest(TENANT, otra)).resolves.toBeDefined();
    });

    test('el folio se compara ya normalizado entre motores', async () => {
      await servicio.confirmIngest(TENANT, factura);

      // El extractor nativo entrega FAC-11354 y Gemini 11354: es la misma factura
      const conPrefijo = { ...factura, folio_factura: 'FAC-11354' };
      await expect(servicio.confirmIngest(TENANT, conPrefijo)).rejects.toThrow(/ya fue ingresada/i);
    });
  });

  describe('2. Un intento se gasta por el documento, no por el servicio', () => {
    let directorio: string;
    let cola: InvoiceQueueService;

    beforeEach(() => {
      directorio = fs.mkdtempSync(path.join(os.tmpdir(), 'gestock-cola-'));
      const store = new InvoiceFileStore(directorio, 10);
      const ingestion = new InvoiceIngestionService(
        undefined,
        new OcrDispatcherService(servicioCaido, servicioCaido),
        store
      );
      cola = new InvoiceQueueService(defaultSqliteClient, store, ingestion, 3);
    });

    afterEach(() => {
      fs.rmSync(directorio, { recursive: true, force: true });
    });

    test('reconoce el fallo del servicio y lo separa del fallo del documento', () => {
      expect(esFalloDelServicio(new Error('getaddrinfo ENOTFOUND generativelanguage.googleapis.com'))).toBe(true);
      expect(esFalloDelServicio(new Error('No fue posible digitalizar el documento'))).toBe(true);
      expect(esFalloDelServicio(new Error('429 rate limit exceeded'))).toBe(true);
      expect(esFalloDelServicio(new Error('la columna cantidad no admite nulos'))).toBe(false);
    });

    test('tres caidas del servicio no agotan los intentos', async () => {
      cola.encolar(TENANT, Buffer.from('documento legible').toString('base64'), 'f.jpg', 'image/jpeg');

      for (let i = 0; i < 3; i += 1) {
        await cola.procesarPendientes(TENANT);
      }

      // Antes quedaba FALLIDA_OCR con el documento intacto, solo porque el servicio no respondio
      const enCola = cola.listar(TENANT);
      expect(enCola[0].estado).toBe(ESTADO_PENDIENTE);
      expect(Number(enCola[0].sync_attempts)).toBe(0);
    });

    test('la factura sigue contando como pendiente y no como fallida', async () => {
      cola.encolar(TENANT, Buffer.from('documento legible').toString('base64'), 'f.jpg', 'image/jpeg');

      const r = await cola.procesarPendientes(TENANT);

      expect(r.pendientes).toBe(1);
      expect(r.fallidas).toBe(0);
      expect(cola.contarPendientes(TENANT)).toBe(1);
    });

    test('el documento ilegible si sale de la cola de inmediato', async () => {
      const ilegible: IOcrProvider = {
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
      const store = new InvoiceFileStore(directorio, 10);
      const otraCola = new InvoiceQueueService(
        defaultSqliteClient,
        store,
        new InvoiceIngestionService(undefined, new OcrDispatcherService(ilegible, ilegible), store),
        3
      );
      otraCola.encolar(TENANT, Buffer.from('foto movida').toString('base64'), 'mala.jpg', 'image/jpeg');

      const r = await otraCola.procesarPendientes(TENANT);

      // La distincion funciona en los dos sentidos: el documento malo no se reintenta en vano
      expect(r.fallidas).toBe(1);
      expect(otraCola.listar(TENANT)[0].estado).toBe(ESTADO_FALLIDA);
    });
  });
});

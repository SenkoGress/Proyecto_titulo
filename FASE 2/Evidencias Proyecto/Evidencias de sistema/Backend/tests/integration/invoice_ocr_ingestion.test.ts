import { PostgresClient } from '../../src/database/postgres/client';
import { InvoiceIngestionService } from '../../src/invoices/invoice-ingestion.service';
import { OcrDispatcherService } from '../../src/ocr/ocr-dispatcher.service';
import { createTestPostgresClient } from '../helpers/db-test-helper';
import {
  createFixtureIds,
  sampleProducto,
  sampleProveedor,
  sampleTenant
} from '../helpers/fixtures';

describe('Smart Invoice Ingestion & Resilient OCR Fallback', () => {
  let pgClient: PostgresClient;
  let dispatcher: OcrDispatcherService;
  let ingestionService: InvoiceIngestionService;

  beforeAll(async () => {
    const pgSetup = await createTestPostgresClient();
    pgClient = pgSetup.client;
    dispatcher = new OcrDispatcherService();
    ingestionService = new InvoiceIngestionService(pgClient, dispatcher);
  });

  afterAll(async () => {
    await pgClient.close();
  });

  test('1. Ingesta transaccional: Actualiza factura, stock de productos y genera historial de auditoría', async () => {
    const ids = createFixtureIds();
    const tenant = sampleTenant(ids.tenantId);
    const prod = sampleProducto(ids.productoId, ids.tenantId);
    prod.sku = 'SKU-BEBIDA-COLA';

    // Insertar tenant y producto con stock inicial 10.0
    await pgClient.query(`INSERT INTO tenants (id, nombre, estado) VALUES ($1, $2, $3)`, [tenant.id, tenant.nombre, tenant.estado]);
    await pgClient.query(
      `INSERT INTO productos (id, tenant_id, sku, nombre, stock_actual, precio_compra, precio_venta)
       VALUES ($1, $2, $3, $4, 10.0, 500, 1000)`,
      [prod.id, prod.tenant_id, prod.sku, prod.nombre]
    );

    const invoicePayload = {
      folio_factura: `FAC-${Date.now().toString().slice(-6)}`,
      rut_proveedor: '76.998.776-5',
      razon_social: 'Distribuidora Central Mayorista Ltda.',
      fecha_emision: '2026-09-10',
      items: [
        {
          sku: prod.sku,
          descripcion: 'Bebida Cola 1.5L Pack x6',
          cantidad: 24.0,
          precio_unitario: 850.0,
          subtotal: 20400.0
        }
      ],
      total: 20400.0
    };

    const startTime = Date.now();

    // Ingestar factura
    const result = await ingestionService.ingestInvoice(ids.tenantId, {
      invoiceData: JSON.stringify(invoicePayload),
      fileName: 'factura_electronica_998.pdf'
    });

    const duration = Date.now() - startTime;

    // Validacion de latencia < 500ms
    expect(duration).toBeLessThan(500);

    // Verificaciones de la ingesta
    expect(result.folio_factura).toBe(invoicePayload.folio_factura);
    expect(result.total).toBe(20400.0);
    expect(result.items_count).toBe(1);

    // 1. Comprobar que en productos el stock aumentó de 10 a 34 (10 + 24)
    const prodCheck = await pgClient.query<{ stock_actual: string }>(
      'SELECT stock_actual FROM productos WHERE id = $1',
      [prod.id]
    );
    expect(Number(prodCheck.rows[0].stock_actual)).toBe(34.0);

    // 2. Comprobar que en factura_ingresos se guardó con estado PROCESSED
    const invCheck = await pgClient.query<{ estado: string; total: string; numero_factura: string }>(
      'SELECT estado, total, numero_factura FROM factura_ingresos WHERE id = $1',
      [result.invoice_id]
    );
    expect(invCheck.rows[0].estado).toBe('PROCESSED');
    expect(Number(invCheck.rows[0].total)).toBe(20400.0);
    expect(invCheck.rows[0].numero_factura).toBe(invoicePayload.folio_factura);

    // 3. Comprobar que en historial_stock se registró el movimiento de tipo ingreso_factura
    const historyCheck = await pgClient.query<{ cambio: string; tipo_movimiento: string; cambio_anterior: string; nuevo_stock: string }>(
      `SELECT cambio, tipo_movimiento, cambio_anterior, nuevo_stock 
       FROM historial_stock 
       WHERE producto_id = $1 AND tenant_id = $2 AND tipo_movimiento = 'ingreso_factura'
       ORDER BY fecha_movimiento DESC LIMIT 1`,
      [prod.id, ids.tenantId]
    );
    expect(Number(historyCheck.rows[0].cambio)).toBe(24.0);
    expect(Number(historyCheck.rows[0].cambio_anterior)).toBe(10.0);
    expect(Number(historyCheck.rows[0].nuevo_stock)).toBe(34.0);
  });

  test('2. Degradación Elegante Conmutación automática a Mock OCR ante fallo del proveedor primario', async () => {
    const ids = createFixtureIds();
    const tenant = sampleTenant(ids.tenantId);

    await pgClient.query(`INSERT INTO tenants (id, nombre, estado) VALUES ($1, $2, $3)`, [tenant.id, tenant.nombre, tenant.estado]);

    // Simulamos fallo del proveedor primario (Gemini 429 Rate Limit / Timeout)
    const result = await ingestionService.ingestInvoice(ids.tenantId, {
      invoiceData: 'raw_binary_corrupted_or_offline_mock',
      fileName: 'factura_timeout.jpg',
      simulateFailure: true // Activa fallo inducido
    });

    // Debe conmutar exitosamente al proveedor Mock sin lanzar error fatal
    expect(result.used_fallback).toBe(true);
    expect(result.ocr_provider).toBe('MockOcrFallback');
    expect(result.items_count).toBeGreaterThan(0);
    expect(result.total).toBeGreaterThan(0);

    // Verificar que la factura se persistió en PostgreSQL a pesar del fallo del proveedor primario
    const savedInv = await pgClient.query('SELECT id FROM factura_ingresos WHERE id = $1', [result.invoice_id]);
    expect(savedInv.rows.length).toBe(1);
  });
});

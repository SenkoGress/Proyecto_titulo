import http from 'http';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import app from '../../backend/src/index';
import { initializeDatabase } from '../../backend/src/database/init-db';
import { defaultPgClient } from '../../backend/src/database/postgres/client';
import { defaultSqliteClient } from '../../backend/src/database/sqlite/client';

const DEMO_TENANT = '00000000-0000-0000-0000-000000000001';
const DEMO_USER = '00000000-0000-0000-0000-000000000002';
const DEMO_SALE_PAY = '00000000-0000-0000-0000-000000000099';

// Generar par RSA de 1024 bits para simular el Timbre Electrónico DTE legítimo
const rsaKey = crypto.generateKeyPairSync('rsa', {
  modulusLength: 1024,
  publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' }
});

describe('Batería Completa de Verificación: Cobertura del 100% de Endpoints (72/72)', () => {
  let server: http.Server;
  let baseUrl: string;
  let dteId = 'demo-dte-01';
  let provId = 'prov-demo-01';
  let sesionCajaId = 'caja-sesion-demo';
  let scannedExtracted: any = null;

  beforeAll(async () => {
    // Modo seguro con circuit breaker para pruebas aisladas
    defaultPgClient.tripCircuit();
    await initializeDatabase();

    // Sembrar venta de referencia para pruebas de pago y devolución
    defaultSqliteClient.execute(
      `INSERT OR REPLACE INTO transacciones_venta 
       (id, tenant_id, usuario_id, folio_local_sqlite, total, unidades, estado, metodo_pago_id, is_dirty, sync_attempts, sync_status, fecha)
       VALUES (?, ?, ?, 'FOLIO-DEMO-PAY', 5000, 1, 'COMPLETADA', '11111111-0000-0000-0000-000000000001', 0, 0, 'SYNCED', datetime('now'))`,
      [DEMO_SALE_PAY, DEMO_TENANT, DEMO_USER]
    );
    defaultSqliteClient.execute(
      `INSERT OR REPLACE INTO detalle_venta 
       (id, venta_id, producto_id, cantidad, precio_unitario, subtotal)
       VALUES (?, ?, '33333333-0000-0000-0000-000000000001', 1, 5000, 5000)`,
      [uuidv4(), DEMO_SALE_PAY]
    );

    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  async function requestApi(
    method: string,
    path: string,
    body?: any,
    headers: Record<string, string> = {}
  ) {
    const defaultHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Tenant-Id': DEMO_TENANT,
      ...headers
    };

    const options: RequestInit = {
      method,
      headers: defaultHeaders
    };
    if (body) {
      options.body = JSON.stringify(body);
    }

    const res = await fetch(`${baseUrl}${path}`, options);
    let data: any = null;
    const text = await res.text();
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return { status: res.status, data };
  }

  describe('1. Core & Health Endpoints', () => {
    test('1. GET /health responde con estado del servicio', async () => {
      const res = await requestApi('GET', '/health');
      expect([200, 503]).toContain(res.status);
      expect(res.data).toHaveProperty('status');
      expect(res.data).toHaveProperty('services');
    });

    test('2. GET /api responde con metadatos de la arquitectura', async () => {
      const res = await requestApi('GET', '/api');
      expect(res.status).toBe(200);
      expect(res.data.status).toBe('ONLINE');
      expect(Array.isArray(res.data.modules)).toBe(true);
    });
  });

  describe('2. Módulo de Cierre de Caja (caja.routes.ts)', () => {
    test('3. POST /api/v1/caja/abrir abre sesión de caja', async () => {
      const res = await requestApi('POST', '/api/v1/caja/abrir', {
        tenant_id: DEMO_TENANT,
        usuario_id: DEMO_USER,
        monto_apertura: 50000
      });
      expect([200, 201]).toContain(res.status);
      expect(res.data.success).toBe(true);
      if (res.data.data?.id) sesionCajaId = res.data.data.id;
    });

    test('4. GET /api/v1/caja/resumen retorna arqueo en curso', async () => {
      const res = await requestApi('GET', `/api/v1/caja/resumen?tenant_id=${DEMO_TENANT}`);
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
    });

    test('5. POST /api/v1/caja/movimiento registra aporte de efectivo', async () => {
      const res = await requestApi('POST', '/api/v1/caja/movimiento', {
        tenant_id: DEMO_TENANT,
        usuario_id: DEMO_USER,
        tipo: 'INGRESO',
        monto: 10000,
        motivo: 'Fondo para cambio'
      });
      expect([200, 201]).toContain(res.status);
      expect(res.data.success).toBe(true);
    });

    test('6. GET /api/v1/caja/movimientos retorna lista de ingresos/egresos', async () => {
      const res = await requestApi('GET', `/api/v1/caja/movimientos?sesion_id=${sesionCajaId}&tenant_id=${DEMO_TENANT}`);
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      expect(Array.isArray(res.data.data)).toBe(true);
    });

    test('7. POST /api/v1/caja/cerrar efectúa arqueo ciego y cierre de turno', async () => {
      const res = await requestApi('POST', '/api/v1/caja/cerrar', {
        tenant_id: DEMO_TENANT,
        usuario_id: DEMO_USER,
        monto_real_efectivo: 60000,
        observaciones: 'Cierre conforme'
      });
      expect([200, 201]).toContain(res.status);
      expect(res.data.success).toBe(true);
    });

    test('8. GET /api/v1/caja/historial retorna reportes Z cerrados', async () => {
      const res = await requestApi('GET', `/api/v1/caja/historial?tenant_id=${DEMO_TENANT}`);
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      expect(Array.isArray(res.data.data)).toBe(true);
    });
  });

  describe('3. Módulo de Configuración (config.routes.ts)', () => {
    test('9. GET /api/v1/config/margin recupera margen de ganancia', async () => {
      const res = await requestApi('GET', `/api/v1/config/margin?tenant_id=${DEMO_TENANT}`);
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      expect(res.data).toHaveProperty('margin');
    });

    test('10. POST /api/v1/config/margin guarda nuevo margen de ganancia', async () => {
      const res = await requestApi('POST', '/api/v1/config/margin', {
        tenant_id: DEMO_TENANT,
        margin: 32
      });
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
    });

    test('11. GET /api/v1/config/email obtiene configuración de correo', async () => {
      const res = await requestApi('GET', `/api/v1/config/email?tenant_id=${DEMO_TENANT}`);
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
    });

    test('12. POST /api/v1/config/email actualiza destinatario de órdenes', async () => {
      const res = await requestApi('POST', '/api/v1/config/email', {
        tenant_id: DEMO_TENANT,
        email: 'compras@gestock.cl',
        auto_send: true
      });
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
    });
  });

  describe('4. Dashboard Global de Analítica (dashboard.routes.ts)', () => {
    test('13. GET /api/v1/dashboard/overview retorna métricas comerciales', async () => {
      const res = await requestApi('GET', `/api/v1/dashboard/overview?tenantId=${DEMO_TENANT}&periodo=mensual`);
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      expect(res.data.data).toHaveProperty('kpis');
      expect(res.data.data).toHaveProperty('topProducts');
    });
  });

  describe('5. Módulo Tributario DTE & SII (dte.routes.ts)', () => {
    test('14. GET /api/v1/dte/config retorna configuración fiscal', async () => {
      const res = await requestApi('GET', `/api/v1/dte/config?tenantId=${DEMO_TENANT}`);
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      expect(res.data.data).toHaveProperty('pciDssCompliance');
    });

    test('15. POST /api/v1/dte/config actualiza modelo de emisión', async () => {
      const res = await requestApi('POST', '/api/v1/dte/config', {
        tenantId: DEMO_TENANT,
        modeloEmision: 'MODELO_A',
        rut: '76.123.456-0',
        razonSocial: 'Minimarket GesTock SpA'
      });
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
    });

    test('16. GET /api/v1/dte/caf/status consulta disponibilidad de folios CAF', async () => {
      const res = await requestApi('GET', `/api/v1/dte/caf/status?tenantId=${DEMO_TENANT}`);
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
    });

    test('17. POST /api/v1/dte/caf/upload sube rango de folios autorizados', async () => {
      const xml = `<AUTORIZACION><CAF version="1.0"><DA><RE>76123456-7</RE><RS>DEMO</RS><TD>39</TD><RNG><D>1</D><H>500</H></RNG><FA>2026-09-01</FA><RSAPK><M>AQAB</M><E>AQAB</E></RSAPK></DA><FRMA algoritmo="SHA1withRSA">DEMO</FRMA></CAF><RSASK>${rsaKey.privateKey}</RSASK></AUTORIZACION>`;
      const res = await requestApi('POST', '/api/v1/dte/caf/upload', {
        tenantId: DEMO_TENANT,
        xmlContent: xml
      });
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
    });

    test('18. POST /api/v1/dte/emit genera boleta electrónica DTE 39', async () => {
      const res = await requestApi('POST', '/api/v1/dte/emit', {
        tenantId: DEMO_TENANT,
        tipoDte: 39,
        items: [
          { codigo: 'PROD-01', nombre: 'Bebida Energética 500ml', cantidad: 1, precioUnitario: 1500 }
        ],
        metodoPago: 'EFECTIVO'
      });
      expect([200, 201]).toContain(res.status);
      expect(res.data.success).toBe(true);
      if (res.data.data?.id) {
        dteId = res.data.data.id;
      }
    });

    test('19. GET /api/v1/dte/list lista documentos tributarios emitidos', async () => {
      const res = await requestApi('GET', `/api/v1/dte/list?tenantId=${DEMO_TENANT}`);
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      expect(Array.isArray(res.data.data)).toBe(true);
    });

    test('20. GET /api/v1/dte/:id/xml descarga XML del DTE', async () => {
      const res = await requestApi('GET', `/api/v1/dte/${dteId}/xml`);
      expect([200, 404]).toContain(res.status);
    });

    test('21. GET /api/v1/dte/:id/receipt retorna representación de ticket térmico', async () => {
      const res = await requestApi('GET', `/api/v1/dte/${dteId}/receipt`);
      expect([200, 404]).toContain(res.status);
    });

    test('22. POST /api/v1/dte/rcof/generate genera reporte diario RCOF', async () => {
      const res = await requestApi('POST', '/api/v1/dte/rcof/generate', {
        tenantId: DEMO_TENANT,
        fecha: '2026-09-16'
      });
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
    });

    test('23. GET /api/v1/dte/rcof/list lista envíos RCOF históricos', async () => {
      const res = await requestApi('GET', `/api/v1/dte/rcof/list?tenantId=${DEMO_TENANT}`);
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
    });

    test('24. POST /api/v1/dte/certification/run-set ejecuta homologación técnica Maullín', async () => {
      const res = await requestApi('POST', '/api/v1/dte/certification/run-set', {
        tenantId: DEMO_TENANT
      });
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
    });

    test('25. POST /api/v1/dte/send-email despacha DTE por correo a receptor', async () => {
      const res = await requestApi('POST', '/api/v1/dte/send-email', {
        email: 'cliente@ejemplo.cl',
        dteId
      });
      expect([200, 201]).toContain(res.status);
      expect(res.data.success).toBe(true);
    });

    test('26. GET /api/v1/dte/f29 calcula propuesta mensual de F29', async () => {
      const res = await requestApi('GET', `/api/v1/dte/f29?tenantId=${DEMO_TENANT}&periodo=2026-09`);
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      expect(res.data.data).toHaveProperty('debitoFiscal');
      expect(res.data.data).toHaveProperty('creditoFiscal');
    });

    test('27. POST /api/v1/dte/guias/emitir emite Guía de Despacho DTE 52', async () => {
      const res = await requestApi('POST', '/api/v1/dte/guias/emitir', {
        tenantId: DEMO_TENANT,
        receptorRut: '76.123.456-0',
        receptorRazonSocial: 'Bodega Central',
        direccionDestino: 'Av. Industrial 123',
        items: [{ nombre: 'Harina 25kg', cantidad: 4, precioUnitario: 12000 }]
      });
      expect([200, 201]).toContain(res.status);
      expect(res.data.success).toBe(true);
    });

    test('28. GET /api/v1/dte/guias lista guías de despacho emitidas', async () => {
      const res = await requestApi('GET', `/api/v1/dte/guias?tenantId=${DEMO_TENANT}`);
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
    });

    test('29. GET /api/v1/dte/backup/export descarga respaldo legal de 6 años', async () => {
      const res = await requestApi('GET', `/api/v1/dte/backup/export?tenantId=${DEMO_TENANT}`);
      expect(res.status).toBe(200);
      expect(res.data).toHaveProperty('sistema');
      expect(res.data).toHaveProperty('totales_registros');
    });
  });

  describe('6. Módulo de Facturas e Ingesta OCR (invoice.routes.ts)', () => {
    test('30. POST /api/v1/invoices/scan procesa escaneo con fallback tolerante', async () => {
      const res = await requestApi('POST', '/api/v1/invoices/scan', {
        tenant_id: DEMO_TENANT,
        file_name: 'factura_mock.pdf',
        invoice_data: 'JVBERi0xLjQKJcTl8uXrp/Og0MTGCjQgMCBvYmoKPDw...',
        simulate_failure: true
      });
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      expect(res.data).toHaveProperty('preview');
      scannedExtracted = res.data.preview.raw_data || res.data.preview;
    });

    test('31. POST /api/v1/invoices/confirm confirma previsualización de factura', async () => {
      const payload = scannedExtracted || {
        folio_factura: 'FAC-88771',
        rut_proveedor: '76.123.456-0',
        razon_social: 'Distribuidora del Sur',
        fecha_emision: '2026-09-16',
        items: [{ sku: 'PROD-01', descripcion: 'Aceite 1L', cantidad: 12, precio_unitario: 1200, subtotal: 14400 }]
      };
      const res = await requestApi('POST', '/api/v1/invoices/confirm', {
        tenant_id: DEMO_TENANT,
        invoice_data: payload
      });
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
    });

    test('32. POST /api/v1/invoices/ingest ingresa factura confirmada al stock', async () => {
      const res = await requestApi('POST', '/api/v1/invoices/ingest', {
        tenant_id: DEMO_TENANT,
        file_name: 'factura_ingesta.pdf',
        invoice_data: 'JVBERi0xLjQKJcTl8uXrp/Og0MTGCjQgMCBvYmoKPDw...',
        simulate_failure: true
      });
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
    });

    test('70. GET /api/v1/invoices/pending consulta la cola de facturas sin digitalizar', async () => {
      const res = await requestApi('GET', `/api/v1/invoices/pending?tenant_id=${DEMO_TENANT}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.data.data)).toBe(true);
      expect(res.data.intentos_maximos).toBeGreaterThan(0);
    });

    test('71. POST /api/v1/invoices/process-pending reintenta la digitalización de la cola', async () => {
      const res = await requestApi('POST', '/api/v1/invoices/process-pending', { tenant_id: DEMO_TENANT });

      expect(res.status).toBe(200);
      expect(res.data.data).toHaveProperty('procesadas');
      expect(res.data.data).toHaveProperty('fallidas');
      expect(res.data.data).toHaveProperty('pendientes');
    });

    test('72. GET /api/v1/invoices/:id/document recupera el respaldo documental de la compra', async () => {
      const res = await requestApi('GET', `/api/v1/invoices/00000000-0000-0000-0000-0000000000ff/document?tenant_id=${DEMO_TENANT}`);

      // Una factura inexistente responde 404 con mensaje accionable, no un error opaco
      expect(res.status).toBe(404);
      expect(res.data.success).toBe(false);
    });

    test('33. GET /api/v1/invoices/ lista historial de facturas ingresadas', async () => {
      const res = await requestApi('GET', `/api/v1/invoices/?tenant_id=${DEMO_TENANT}`);
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      expect(Array.isArray(res.data.data)).toBe(true);
      expect(Array.isArray(res.data.invoices)).toBe(true);
    });
  });

  describe('7. Módulo de Tendencias de Mercado (market.routes.ts)', () => {
    test('34. POST /api/v1/trends/sync sincroniza tendencias externas', async () => {
      const res = await requestApi('POST', '/api/v1/trends/sync', {
        tenant_id: DEMO_TENANT,
        sku: 'SKU-BEBIDA-01',
        keyword: 'bebida energetica',
        source: 'MERCADOLIBRE'
      });
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
    });

    test('35. GET /api/v1/trends/ consulta productos con alta demanda externa', async () => {
      const res = await requestApi('GET', `/api/v1/trends/?tenant_id=${DEMO_TENANT}`);
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      expect(Array.isArray(res.data.data)).toBe(true);
    });

    test('36. GET /api/v1/trends/:tenantId consulta tendencias filtradas por comercio', async () => {
      const res = await requestApi('GET', `/api/v1/trends/${DEMO_TENANT}`);
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
    });
  });

  describe('8. Pasarelas de Pago & Contingencia (payment.routes.ts)', () => {
    test('37. POST /api/v1/payments/initiate inicia transacción de pago', async () => {
      const res = await requestApi('POST', '/api/v1/payments/initiate', {
        tenantId: DEMO_TENANT,
        saleId: DEMO_SALE_PAY,
        amount: 5000,
        gateway: 'Transbank',
        paymentMethod: 'DEBIT'
      });
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
    });

    test('38. POST /api/v1/payments/confirm confirma voucher de pago', async () => {
      const res = await requestApi('POST', '/api/v1/payments/confirm', {
        tenantId: DEMO_TENANT,
        saleId: DEMO_SALE_PAY,
        gateway: 'Transbank',
        token: 'auth-token-123'
      });
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
    });

    test('39. GET /api/v1/payments/sale/:saleId consulta pagos asociados a una venta', async () => {
      const res = await requestApi('GET', `/api/v1/payments/sale/${DEMO_SALE_PAY}`);
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      expect(res.data).toHaveProperty('transactions');
    });
  });

  describe('9. Operación del Punto de Venta (pos.routes.ts)', () => {
    test('40. GET /api/v1/pos/products obtiene catálogo activo con IVA e ILA', async () => {
      const res = await requestApi('GET', `/api/v1/pos/products?tenant_id=${DEMO_TENANT}`);
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      expect(Array.isArray(res.data.data)).toBe(true);
    });

    test('41. GET /api/v1/pos/status consulta estado de sincronización y nodo', async () => {
      const res = await requestApi('GET', `/api/v1/pos/status?tenant_id=${DEMO_TENANT}`);
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      expect(res.data).toHaveProperty('cloud_online');
      expect(res.data).toHaveProperty('pending_dirty_count');
    });

    test('42. POST /api/v1/pos/checkout procesa venta en caja con bolsa de $1.000', async () => {
      const res = await requestApi('POST', '/api/v1/pos/checkout', {
        tenant_id: DEMO_TENANT,
        usuario_id: DEMO_USER,
        items: [
          { producto_id: '33333333-0000-0000-0000-000000000001', cantidad: 1, precio_unitario: 1200 }
        ],
        metodo_pago: 'EFECTIVO',
        tipo_comprobante: 'BOLETA'
      });
      expect([200, 201]).toContain(res.status);
      expect(res.data.success).toBe(true);
    });

    test('43. POST /api/v1/pos/sync ejecuta sincronización con tolerancia offline', async () => {
      const res = await requestApi('POST', '/api/v1/pos/sync', {
        tenant_id: DEMO_TENANT
      });
      expect([200, 503]).toContain(res.status);
    });

    test('44. GET /api/v1/pos/inventory consulta stock físico en SQLite', async () => {
      const res = await requestApi('GET', `/api/v1/pos/inventory?tenant_id=${DEMO_TENANT}`);
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      expect(Array.isArray(res.data.data)).toBe(true);
    });

    test('45. GET /api/v1/pos/vencimientos consulta semáforo FEFO de caducidad', async () => {
      const res = await requestApi('GET', `/api/v1/pos/vencimientos?tenant_id=${DEMO_TENANT}`);
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
    });

    test('46. GET /api/v1/pos/transactions lista ventas locales registradas', async () => {
      const res = await requestApi('GET', `/api/v1/pos/transactions?tenant_id=${DEMO_TENANT}`);
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      expect(Array.isArray(res.data.data)).toBe(true);
    });

    test('47. POST /api/v1/pos/devolucion emite nota de crédito y repone stock', async () => {
      const res = await requestApi('POST', '/api/v1/pos/devolucion', {
        tenant_id: DEMO_TENANT,
        usuario_id: DEMO_USER,
        venta_id: DEMO_SALE_PAY,
        motivo: 'Garantía Legal Ley N° 21.398'
      });
      expect([200, 201]).toContain(res.status);
      expect(res.data.success).toBe(true);
    });
  });

  describe('10. Reabastecimiento Predictivo (replenishment.routes.ts)', () => {
    test('48. GET /api/v1/replenishment/velocity calcula rotación diaria de productos', async () => {
      const res = await requestApi('GET', `/api/v1/replenishment/velocity?tenant_id=${DEMO_TENANT}`);
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      expect(Array.isArray(res.data.velocities)).toBe(true);
    });

    test('49. GET /api/v1/replenishment/suggest calcula sugerencias según ROP', async () => {
      const res = await requestApi('GET', `/api/v1/replenishment/suggest?tenant_id=${DEMO_TENANT}`);
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      expect(res.data).toHaveProperty('orders');
    });

    test('50. POST /api/v1/replenishment/suggest agrupa órdenes por proveedor', async () => {
      const res = await requestApi('POST', '/api/v1/replenishment/suggest', {
        tenant_id: DEMO_TENANT
      });
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      expect(res.data).toHaveProperty('orders');
    });

    test('51. POST /api/v1/replenishment/send-email envía órdenes al proveedor', async () => {
      const res = await requestApi('POST', '/api/v1/replenishment/send-email', {
        tenant_id: DEMO_TENANT
      });
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
    });

    test('52. GET /api/v1/replenishment/purchase-orders lista órdenes históricas', async () => {
      const res = await requestApi('GET', `/api/v1/replenishment/purchase-orders?tenant_id=${DEMO_TENANT}`);
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      expect(Array.isArray(res.data.orders)).toBe(true);
    });
  });

  describe('11. Directorio de Proveedores (supplier.routes.ts)', () => {
    test('53. GET /api/v1/suppliers/ lista proveedores registrados', async () => {
      const res = await requestApi('GET', `/api/v1/suppliers/?tenant_id=${DEMO_TENANT}`);
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      expect(Array.isArray(res.data.data)).toBe(true);
    });

    test('54. POST /api/v1/suppliers/ crea un nuevo proveedor con días de visita', async () => {
      const res = await requestApi('POST', '/api/v1/suppliers/', {
        tenant_id: DEMO_TENANT,
        nombre_proveedores: 'Distribuidora Central Los Lagos',
        rut_proveedor: '78.999.888-2',
        telefono: '+56987654321',
        dias_visita_proveedores: 'Lunes, Miercoles'
      });
      expect([200, 201]).toContain(res.status);
      expect(res.data.success).toBe(true);
      if (res.data.data?.id) provId = res.data.data.id;
    });

    test('55. PUT /api/v1/suppliers/:id actualiza información de visita', async () => {
      const res = await requestApi('PUT', `/api/v1/suppliers/${provId}`, {
        dias_visita_proveedores: 'Martes, Jueves'
      });
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
    });
  });

  describe('12. Motor de Sincronización Push / Pull (sync.routes.ts)', () => {
    test('56. POST /api/v1/sync/push procesa lotes de sincronización con idempotencia', async () => {
      const res = await requestApi('POST', '/api/v1/sync/push', {
        tenant_id: DEMO_TENANT,
        sales: []
      });
      expect([200, 503]).toContain(res.status);
    });

    test('57. GET /api/v1/sync/pull descarga delta del catálogo desde la nube', async () => {
      const res = await requestApi('GET', `/api/v1/sync/pull?tenant_id=${DEMO_TENANT}`);
      expect([200, 503]).toContain(res.status);
    });
  });
  describe('13. Gestión de Productos, Stock y Mermas (pos.routes.ts)', () => {
    const sufijo = Date.now();
    const sku = `SKU-VERIF-${sufijo}`;
    let productoId = '';

    test('58. POST /api/v1/pos/products da de alta un producto en el catálogo', async () => {
      const res = await requestApi('POST', '/api/v1/pos/products', {
        tenant_id: DEMO_TENANT,
        nombre: 'Producto de Verificación',
        sku,
        codigo_barra: `78${String(sufijo).slice(-11)}`,
        precio_compra: 800,
        precio_venta: 1500,
        stock_actual: 20,
        stock_minimo: 5,
        categoria: 'Bebidas'
      });

      expect(res.status).toBe(201);
      expect(res.data.success).toBe(true);
      expect(res.data.data.sku).toBe(sku);
      productoId = res.data.data.id;
      expect(productoId).toBeTruthy();
    });

    test('59. PUT /api/v1/pos/products/:id actualiza nombre, precio y categoría', async () => {
      const res = await requestApi('PUT', `/api/v1/pos/products/${productoId}`, {
        nombre: 'Producto de Verificación Editado',
        precio_venta: 1800,
        categoria: 'Abarrotes'
      });

      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      expect(res.data.data.nombre).toBe('Producto de Verificación Editado');
    });

    test('60. PATCH /api/v1/pos/products/:id/stock ajusta el conteo físico', async () => {
      const res = await requestApi('PATCH', `/api/v1/pos/products/${productoId}/stock`, {
        tenant_id: DEMO_TENANT,
        nuevo_stock: 15,
        motivo: 'Ajuste por conteo físico de verificación'
      });

      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
    });

    test('61. POST /api/v1/pos/mermas registra una baja por vencimiento', async () => {
      const res = await requestApi('POST', '/api/v1/pos/mermas', {
        tenant_id: DEMO_TENANT,
        producto_id: productoId,
        cantidad: 3,
        motivo: 'vencimiento',
        observaciones: 'Unidades retiradas de góndola en la verificación'
      });

      expect(res.status).toBe(201);
      expect(res.data.success).toBe(true);
    });

    test('62. GET /api/v1/pos/mermas lista las bajas registradas del comercio', async () => {
      const res = await requestApi('GET', `/api/v1/pos/mermas?tenant_id=${DEMO_TENANT}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.data.data)).toBe(true);
      expect(res.data.data.some((m: any) => m.producto_id === productoId)).toBe(true);
    });

    test('63. GET /api/v1/pos/stock-history consulta el libro de movimientos', async () => {
      const res = await requestApi('GET', `/api/v1/pos/stock-history?tenant_id=${DEMO_TENANT}&producto_id=${productoId}`);

      expect(res.status).toBe(200);
      expect(res.data.count).toBeGreaterThan(0);
      expect(res.data.data.every((h: any) => h.producto_id === productoId)).toBe(true);
    });

    test('64. GET /api/v1/pos/products/:id/history traza el alta, el ajuste y la merma', async () => {
      const res = await requestApi('GET', `/api/v1/pos/products/${productoId}/history?tenant_id=${DEMO_TENANT}`);

      expect(res.status).toBe(200);
      // El producto acumula tres movimientos: alta inicial, ajuste de conteo y merma
      expect(res.data.data.length).toBeGreaterThanOrEqual(3);
      expect(res.data.data.every((h: any) => h.producto_id === productoId)).toBe(true);
    });
  });

  describe('14. Autenticación y Gestión de Personal (auth.routes.ts)', () => {
    const correoCajero = `verificacion_${Date.now()}@gestock.cl`;
    const claveInicial = 'ClaveVerificacion2026';
    const claveRotada = 'ClaveRotada2026';
    let adminToken = '';

    test('65. POST /api/v1/auth/login emite un JWT firmado y perfil sin hash', async () => {
      const res = await requestApi('POST', '/api/v1/auth/login', {
        tenant_id: DEMO_TENANT,
        email: 'admin@gestock.cl',
        password: 'admin123'
      });

      expect(res.status).toBe(200);
      expect(res.data.data.token.split('.')).toHaveLength(3);
      expect(res.data.data.usuario.rol).toBe('admin');
      expect(res.data.data.usuario.password_hash).toBeUndefined();
      adminToken = res.data.data.token;
    });

    test('66. GET /api/v1/auth/me reconoce la sesión activa del token', async () => {
      const res = await requestApi('GET', '/api/v1/auth/me', undefined, {
        Authorization: `Bearer ${adminToken}`
      });

      expect(res.status).toBe(200);
      expect(res.data.data.usuario.email).toBe('admin@gestock.cl');
    });

    test('67. GET /api/v1/auth/users lista el personal sin exponer contraseñas', async () => {
      const res = await requestApi('GET', '/api/v1/auth/users', undefined, {
        Authorization: `Bearer ${adminToken}`
      });

      expect(res.status).toBe(200);
      expect(res.data.data.length).toBeGreaterThan(0);
      expect(res.data.data.every((u: any) => u.password_hash === undefined)).toBe(true);
    });

    test('68. POST /api/v1/auth/register crea un cajero en el comercio del administrador', async () => {
      const res = await requestApi('POST', '/api/v1/auth/register', {
        tenant_id: DEMO_TENANT,
        nombre: 'Cajero de Verificación',
        email: correoCajero,
        password: claveInicial,
        rol: 'cajero'
      }, { Authorization: `Bearer ${adminToken}` });

      expect(res.status).toBe(201);
      expect(res.data.data.usuario.rol).toBe('cajero');
      expect(res.data.data.usuario.tenant_id).toBe(DEMO_TENANT);
      expect(res.data.token).toBeUndefined();
    });

    test('69. PUT /api/v1/auth/password rota la clave y revoca la anterior', async () => {
      const sesion = await requestApi('POST', '/api/v1/auth/login', {
        tenant_id: DEMO_TENANT,
        email: correoCajero,
        password: claveInicial
      });
      expect(sesion.status).toBe(200);

      const cambio = await requestApi('PUT', '/api/v1/auth/password', {
        password_actual: claveInicial,
        password_nueva: claveRotada
      }, { Authorization: `Bearer ${sesion.data.data.token}` });
      expect(cambio.status).toBe(200);

      const conNueva = await requestApi('POST', '/api/v1/auth/login', {
        tenant_id: DEMO_TENANT,
        email: correoCajero,
        password: claveRotada
      });
      expect(conNueva.status).toBe(200);

      const conAnterior = await requestApi('POST', '/api/v1/auth/login', {
        tenant_id: DEMO_TENANT,
        email: correoCajero,
        password: claveInicial
      });
      expect(conAnterior.status).toBe(401);
    });
  });
});

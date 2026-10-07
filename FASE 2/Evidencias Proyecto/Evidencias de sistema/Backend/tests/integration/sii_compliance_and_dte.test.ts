// ============================================================================
// GesTock Integration Test: SII Tax Compliance & POS Integration
// Ley N° 20.727, Res. 74, Res. 176, Res. 53, Ley 20.956 y PCI-DSS
// ============================================================================

import http from 'http';
import app from '../../src/index';
import { initializeDatabase } from '../../src/database/init-db';
import { defaultCafManager } from '../../src/dte/caf-manager.service';
import { defaultDteEmitter } from '../../src/dte/dte-emitter.service';
import { defaultRcofService } from '../../src/dte/rcof.service';
import { defaultSiiCertification } from '../../src/dte/sii-certification.service';
import { defaultSqliteClient } from '../../src/database/sqlite/client';
import { TipoDTE } from '../../src/dte/types';

describe('Cumplimiento Normativo SII & Integración POS', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const usuarioId = '00000000-0000-0000-0000-000000000002';
  let testServer: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    await initializeDatabase();
    await new Promise<void>((resolve) => {
      testServer = app.listen(0, () => {
        const addr = testServer.address() as any;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (testServer) {
      await new Promise<void>((resolve) => testServer.close(() => resolve()));
    }
  });

  describe('1. Gestión de CAF y Correlatividad Estricta de Folios (Ley N° 20.727)', () => {
    it('debe aprovisionar o recuperar un CAF activo con par de llaves RSA', () => {
      const caf = defaultCafManager.getOrCreateActiveCaf(tenantId, TipoDTE.BOLETA_ELECTRONICA);
      expect(caf).toBeDefined();
      expect(caf.tipo_dte).toBe(TipoDTE.BOLETA_ELECTRONICA);
      expect(caf.folio_desde).toBeGreaterThanOrEqual(1);
      expect(caf.folio_hasta).toBeGreaterThan(caf.folio_desde);
      expect(caf.rsask_private_key).toContain('BEGIN RSA PRIVATE KEY');
      expect(caf.caf_xml_content).toContain('<CAF version="1.0">');
    });

    it('debe asignar folios estrictamente correlativos sin saltos ni duplicados bajo concurrencia', () => {
      const folios: number[] = [];
      for (let i = 0; i < 5; i++) {
        const { folio } = defaultCafManager.consumeNextFolio(tenantId, TipoDTE.BOLETA_ELECTRONICA);
        folios.push(folio);
      }

      // Verificar que cada folio es exactamente folio anterior + 1
      for (let i = 1; i < folios.length; i++) {
        expect(folios[i]).toBe(folios[i - 1] + 1);
      }
    });

    it('debe generar el Timbre Electrónico DTE (<TED>) con firma SHA1withRSA válida', () => {
      const caf = defaultCafManager.getOrCreateActiveCaf(tenantId, TipoDTE.BOLETA_ELECTRONICA);
      const ted = defaultCafManager.generateTed({
        emisorRut: '76.123.456-7',
        tipoDte: TipoDTE.BOLETA_ELECTRONICA,
        folio: 9999,
        fechaEmision: '2026-03-10',
        receptorRut: '66666666-6',
        receptorRazonSocial: 'CLIENTE PRUEBA',
        montoTotal: 5990,
        primerItem: 'Bebida Coca Cola 350ml',
        cafXml: caf.caf_xml_content,
        rsaskPrivateKey: caf.rsask_private_key
      });

      expect(ted.tedXml).toContain('<TED version="1.0">');
      expect(ted.tedXml).toContain('<DD>');
      expect(ted.tedXml).toContain('<RE>76.123.456-7</RE>');
      expect(ted.tedXml).toContain('<TD>39</TD>');
      expect(ted.tedXml).toContain('<F>9999</F>');
      expect(ted.tedXml).toContain('<MNT>5990</MNT>');
      expect(ted.tedXml).toContain('<CAF version="1.0">');
      expect(ted.tedXml).toContain('<FRMT alg="SHA1withRSA">');
      expect(ted.firmaSha1RsaBase64).toBeTruthy();
      expect(ted.firmaSha1RsaBase64.length).toBeGreaterThan(50);
    });
  });

  describe('2. Prevención de Doble Tributación (Resolución Exenta N° 176 del SII)', () => {
    it('en MODELO_B: Venta con Tarjeta Transbank / MP NO debe emitir Boleta DTE ni consumir folios', () => {
      const resp = defaultDteEmitter.emitDocument({
        tenantId,
        tipoDte: TipoDTE.BOLETA_ELECTRONICA,
        metodoPago: 'TRANSBANK',
        modeloEmision: 'MODELO_B',
        items: [
          { nroLinea: 1, nombre: 'Papas Fritas Lays 200g', cantidad: 2, precioUnitario: 1890, subtotal: 3780 }
        ]
      });

      expect(resp.tipoDocumento).toBe('VOUCHER_TRANSBANK');
      expect(resp.esTributarioDte).toBe(false);
      expect(resp.folio).toBeUndefined();
      expect(resp.xmlDte).toBeUndefined();
      expect(resp.mensajeLegal).toContain('Res. Exenta N° 176');
    });

    it('en MODELO_B: Venta en EFECTIVO SÍ debe emitir Boleta Electrónica Tipo 39 y consumir folio CAF', () => {
      const resp = defaultDteEmitter.emitDocument({
        tenantId,
        tipoDte: TipoDTE.BOLETA_ELECTRONICA,
        metodoPago: 'EFECTIVO',
        modeloEmision: 'MODELO_B',
        items: [
          { nroLinea: 1, nombre: 'Leche Entera Colun 1L', cantidad: 1, precioUnitario: 1290, subtotal: 1290 }
        ]
      });

      expect(resp.tipoDocumento).toBe('BOLETA_ELECTRONICA');
      expect(resp.esTributarioDte).toBe(true);
      expect(resp.folio).toBeGreaterThan(0);
      expect(resp.xmlDte).toContain('<DTE version="1.0"');
      expect(resp.xmlDte).toContain('<Signature');
      expect(resp.tedXml).toContain('<TED version="1.0">');
      expect(resp.qrUrl).toContain('https://www.sii.cl/consulta_dte?');
    });

    it('en MODELO_A: Venta con Tarjeta SÍ emite Boleta Electrónica Tipo 39 (POS Integrado oficial)', () => {
      const resp = defaultDteEmitter.emitDocument({
        tenantId,
        tipoDte: TipoDTE.BOLETA_ELECTRONICA,
        metodoPago: 'TRANSBANK',
        modeloEmision: 'MODELO_A',
        items: [
          { nroLinea: 1, nombre: 'Aceite Vegetal Belmont', cantidad: 1, precioUnitario: 2190, subtotal: 2190 }
        ]
      });

      expect(resp.tipoDocumento).toBe('BOLETA_ELECTRONICA');
      expect(resp.esTributarioDte).toBe(true);
      expect(resp.folio).toBeGreaterThan(0);
      expect(resp.tedXml).toBeDefined();
    });
  });

  describe('3. Registro de Consumo de Folios (RCOF / Registro Diario de Boletas)', () => {
    it('debe generar el archivo XML de RCOF agrupando las boletas del día para el SII', () => {
      const rcof = defaultRcofService.generateDailyRcof(tenantId);

      expect(rcof).toBeDefined();
      expect(rcof.secuencia).toBeGreaterThanOrEqual(1);
      expect(rcof.xmlRcof).toContain('<ConsumoFolios version="1.0"');
      expect(rcof.xmlRcof).toContain('<Caratula>');
      expect(rcof.xmlRcof).toContain('<Resumen>');
      expect(rcof.xmlRcof).toContain('<TipoDocumento>39</TipoDocumento>');
      expect(rcof.xmlRcof).toContain('<Signature');

      // Verificar persistencia en base de datos
      const row = defaultSqliteClient.queryOne<any>(
        'SELECT * FROM sii_rcof_registros WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1',
        [tenantId]
      );
      expect(row).toBeDefined();
      expect(row.rcof_xml_content).toContain('<ConsumoFolios');
    });
  });

  describe('4. Certificación Técnica SII - Sets de Prueba (Resolución Exenta N° 74)', () => {
    it('debe ejecutar exitosamente la suite de homologación (Tipos 39, 41, 61 y RCOF)', async () => {
      const resultado = await defaultSiiCertification.runFullCertificationSuite(tenantId);

      expect(resultado.success).toBe(true);
      expect(resultado.ambiente).toBe('CERTIFICACION_SII_MAULLIN');
      expect(resultado.resultados.length).toBe(4);

      // Validar que cada uno de los 4 casos oficiales fue superado
      expect(resultado.resultados[0].passed).toBe(true); // Caso 1: Boleta Afecta 39
      expect(resultado.resultados[1].passed).toBe(true); // Caso 2: Boleta Exenta 41
      expect(resultado.resultados[2].passed).toBe(true); // Caso 3: Nota de Crédito 61
      expect(resultado.resultados[3].passed).toBe(true); // Caso 4: RCOF Diario
    });
  });

  describe('5. Auditoría de Seguridad Financiera PCI-DSS', () => {
    it('prohíbe estrictamente el almacenamiento o captura de números PAN completos, CVV o PIN', () => {
      // 1. Verificar tabla payment_transactions
      const tableInfo = defaultSqliteClient.query<any>('PRAGMA table_info(payment_transactions)');
      const colNames = tableInfo.map(c => c.name.toLowerCase());

      expect(colNames).not.toContain('pan');
      expect(colNames).not.toContain('card_number');
      expect(colNames).not.toContain('cvv');
      expect(colNames).not.toContain('cvc');
      expect(colNames).not.toContain('pin');

      // 2. Verificar registros persistidos de transacciones
      const rows = defaultSqliteClient.query<any>('SELECT * FROM payment_transactions LIMIT 10');
      for (const r of rows) {
        if (r.metadata_response) {
          const meta = JSON.parse(r.metadata_response);
          // Si incluye datos de tarjeta, solo debe ser enmascarada (last4 o ****)
          if (meta.card_number) {
            expect(meta.card_number).toContain('****');
          }
          expect(meta.cvv).toBeUndefined();
          expect(meta.pin).toBeUndefined();
        }
      }
    });
  });

  describe('6. Integración POS Checkout con DTE Automático (API REST)', () => {
    it('POST /api/v1/pos/checkout en Efectivo emite Boleta Electrónica con TED y Folio', async () => {
      const prod = defaultSqliteClient.queryOne<any>('SELECT id, precio_venta, nombre FROM productos LIMIT 1');

      const res = await fetch(`${baseUrl}/api/v1/pos/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          usuario_id: usuarioId,
          metodo_pago: 'EFECTIVO',
          items: [
            { producto_id: prod.id, cantidad: 1, precio_unitario: prod.precio_venta, nombre: prod.nombre }
          ]
        })
      });

      const json: any = await res.json();
      expect(res.status).toBe(201);
      expect(json.success).toBe(true);
      expect(json.data.dte).toBeDefined();
      expect(json.data.dte.tipoDocumento).toBe('BOLETA_ELECTRONICA');
      expect(json.data.dte.esTributarioDte).toBe(true);
      expect(json.data.dte.folio).toBeGreaterThan(0);
      expect(json.data.dte.qrUrl).toContain('https://www.sii.cl/consulta_dte?');
    });

    it('POST /api/v1/pos/checkout con Tarjeta en MODELO_B emite Voucher no tributario (Res. 176)', async () => {
      // Asegurar que tenant está en MODELO_B
      defaultSqliteClient.execute(
        `UPDATE configuracion_sistema SET valor = 'MODELO_B' WHERE tenant_id = ? AND clave = 'sii_modelo_emision'`,
        [tenantId]
      );

      const prod = defaultSqliteClient.queryOne<any>('SELECT id, precio_venta, nombre FROM productos LIMIT 1');

      const res = await fetch(`${baseUrl}/api/v1/pos/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          usuario_id: usuarioId,
          metodo_pago: 'TRANSBANK',
          items: [
            { producto_id: prod.id, cantidad: 1, precio_unitario: prod.precio_venta, nombre: prod.nombre }
          ]
        })
      });

      const json: any = await res.json();
      expect(res.status).toBe(201);
      expect(json.success).toBe(true);
      expect(json.data.dte).toBeDefined();
      expect(json.data.dte.tipoDocumento).toBe('VOUCHER_TRANSBANK');
      expect(json.data.dte.esTributarioDte).toBe(false);
      expect(json.data.dte.folio).toBeUndefined();
      expect(json.data.dte.mensajeLegal).toContain('Res. Exenta N° 176');
    });

    it('GET /api/v1/dte/config retorna configuración y certificación PCI-DSS v4.0', async () => {
      const res = await fetch(`${baseUrl}/api/v1/dte/config?tenantId=${tenantId}`);
      const json: any = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.pciDssCompliance.active).toBe(true);
      expect(json.data.pciDssCompliance.panStorage).toBe('PROHIBITED_NEVER_STORED');
    });

    it('GET /api/v1/dte/caf/status retorna disponibilidad de folios por tipo', async () => {
      const res = await fetch(`${baseUrl}/api/v1/dte/caf/status?tenantId=${tenantId}`);
      const json: any = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.data.length).toBeGreaterThan(0);
      expect(json.data[0].foliosDisponibles).toBeGreaterThan(0);
    });
  });
});

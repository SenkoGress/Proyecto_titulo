// ============================================================================
// GesTock Chilean Retail & Tax Compliance Integration Test Suite
// Ley 20.727, DL 825 (ILA), Ley 21.398 (Garantía/NC 61), DS 977/96 (MINSAL),
// Ley 21.131 (Guías 52), Cierre de Caja Z y Pre-Liquidación F29
// ============================================================================

import { v4 as uuidv4 } from 'uuid';
import { initializeDatabase } from '../../src/database/init-db';
import { defaultSqliteClient } from '../../src/database/sqlite/client';
import { defaultCierreCajaService } from '../../src/caja/cierre-caja.service';
import { defaultDteEmitter } from '../../src/dte/dte-emitter.service';
import { defaultF29ReportService } from '../../src/dte/f29-report.service';
import { defaultCafManager } from '../../src/dte/caf-manager.service';
import { TipoDTE } from '../../src/dte/types';

describe('Chilean Retail & Tax Compliance Pack Integration Tests', () => {
  const TEST_TENANT = '00000000-0000-0000-0000-000000000001';
  const TEST_USER = '00000000-0000-0000-0000-000000000002';

  beforeAll(async () => {
    await initializeDatabase();
    // Asegurar que existan CAFs para los tipos 33, 52, 61
    defaultCafManager.getOrCreateActiveCaf(TEST_TENANT, TipoDTE.FACTURA_ELECTRONICA);
    defaultCafManager.getOrCreateActiveCaf(TEST_TENANT, TipoDTE.GUIA_DESPACHO);
    defaultCafManager.getOrCreateActiveCaf(TEST_TENANT, TipoDTE.NOTA_CREDITO);
  });

  describe('1. Cierre y Arqueo de Caja (Arqueo X, Movimientos y Cierre Z)', () => {
    it('debe abrir turno, registrar ingresos/egresos y cuadrar el efectivo esperado', async () => {
      // Si hay una caja abierta previa, cerrarla para comenzar prueba limpia
      const abierta = await defaultCierreCajaService.obtenerResumenTurnoActual(TEST_TENANT);
      if (abierta) {
        await defaultCierreCajaService.cerrarCaja(TEST_TENANT, TEST_USER, abierta.monto_esperado_efectivo, 'Cierre previo');
      }

      // 1. Apertura con $30.000 de fondo inicial
      const sesion = await defaultCierreCajaService.abrirCaja(TEST_TENANT, TEST_USER, 30000);
      expect(sesion.id).toBeDefined();
      expect(sesion.monto_apertura).toBe(30000);
      expect(sesion.estado).toBe('ABIERTA');

      // 2. Registrar egreso (retiro para comprar pan / proveedor: $5.000)
      const egreso = await defaultCierreCajaService.registrarMovimiento(
        TEST_TENANT,
        sesion.id,
        'EGRESO',
        5000,
        'Pago proveedor pan en efectivo',
        TEST_USER
      );
      expect(egreso.tipo).toBe('EGRESO');
      expect(egreso.monto).toBe(5000);

      // 3. Registrar ingreso (inyección de monedas / sencillo: $2.000)
      const ingreso = await defaultCierreCajaService.registrarMovimiento(
        TEST_TENANT,
        sesion.id,
        'INGRESO',
        2000,
        'Aporte sencillo monedas $100',
        TEST_USER
      );
      expect(ingreso.tipo).toBe('INGRESO');
      expect(ingreso.monto).toBe(2000);

      // 4. Verificar balance en vivo
      const resumen = await defaultCierreCajaService.obtenerResumenTurnoActual(TEST_TENANT);
      expect(resumen).not.toBeNull();
      expect(resumen?.total_ingresos_caja).toBe(2000);
      expect(resumen?.total_egresos_caja).toBe(5000);
      // Esperado = 30.000 + 0 ventas + 2.000 - 5.000 = 27.000
      expect(resumen?.monto_esperado_efectivo).toBe(27000);

      // 5. Ejecutar Cierre Z con conteo físico exacto de $27.000
      const cierre = await defaultCierreCajaService.cerrarCaja(TEST_TENANT, TEST_USER, 27000, 'Turno cuadrado');
      expect(cierre.estado).toBe('CERRADA');
      expect(cierre.monto_real_efectivo).toBe(27000);
      expect(cierre.diferencia_efectivo).toBe(0);
    });
  });

  describe('2. Impuesto Adicional a las Bebidas y Licores (ILA - D.L. 825 Arts. 42 y 43)', () => {
    it('debe desglosar correctamente el IVA 19% y el ILA 20.5% para Cervezas y Vinos', () => {
      // Producto: Sixpack Cerveza Artesanal ($10.000 bruto) afecto a ILA 20.5% (Cód 27)
      const itemCerveza = {
        nroLinea: 1,
        nombre: 'Cerveza Austral Calafate 6x330cc',
        cantidad: 1,
        precioUnitario: 10000,
        subtotal: 10000,
        codigoIla: 27,
        tasaIla: 20.5
      };

      const totales = defaultDteEmitter.calculateTotals([itemCerveza]);
      // Factor: 1 + 0.19 + 0.205 = 1.395
      // Neto: 10.000 / 1.395 = 7.168
      // IVA: 7.168 * 0.19 = 1.362
      // ILA: 7.168 * 0.205 = 1.469
      // Suma: 7.168 + 1.362 + 1.469 = 9.999 -> redondeo 10.000
      expect(totales.montoNeto).toBeGreaterThan(7000);
      expect(totales.montoNeto).toBeLessThan(7300);
      expect(totales.montoIla).toBeGreaterThan(1400);
      expect(totales.desgloseIla).toHaveLength(1);
      expect(totales.desgloseIla![0].codigo).toBe(27);
      expect(totales.montoTotal).toBe(10000);

      // Emisión de DTE y verificación de tags XML
      const dte = defaultDteEmitter.emitDocument({
        tenantId: TEST_TENANT,
        tipoDte: TipoDTE.BOLETA_ELECTRONICA,
        metodoPago: 'EFECTIVO',
        items: [itemCerveza]
      });

      expect(dte.xmlDte).toContain('<CodImpAdic>27</CodImpAdic>');
      expect(dte.xmlDte).toContain('<TipoImp>27</TipoImp>');
      expect(dte.xmlDte).toContain('<TasaImp>20.5</TasaImp>');
    });
  });

  describe('3. Factura Electrónica en POS (DTE Tipo 33)', () => {
    it('debe emitir Factura Electrónica Tipo 33 con receptor corporativo completo', () => {
      const dteFactura = defaultDteEmitter.emitDocument({
        tenantId: TEST_TENANT,
        tipoDte: TipoDTE.FACTURA_ELECTRONICA,
        metodoPago: 'EFECTIVO',
        items: [
          {
            nroLinea: 1,
            nombre: 'Insumos de Oficina y Abarrotes',
            cantidad: 2,
            precioUnitario: 15000,
            subtotal: 30000
          }
        ],
        receptor: {
          rut: '77.888.999-0',
          razonSocial: 'CONSTRUCTORA LOS ANDES SPA',
          giro: 'CONSTRUCCION Y OBRAS MENORES',
          direccion: 'CALLE INDUSTRIAL 456',
          comuna: 'PUDAHUEL',
          ciudad: 'SANTIAGO'
        }
      });

      expect(dteFactura.tipoDocumento).toBe('FACTURA');
      expect(dteFactura.tipoDte).toBe(33);
      expect(dteFactura.xmlDte).toContain('<TipoDTE>33</TipoDTE>');
      expect(dteFactura.xmlDte).toContain('<RUTRecep>77.888.999-0</RUTRecep>');
      expect(dteFactura.xmlDte).toContain('<RznSocRecep>CONSTRUCTORA LOS ANDES SPA</RznSocRecep>');
      expect(dteFactura.xmlDte).toContain('<GiroRecep>CONSTRUCCION Y OBRAS MENORES</GiroRecep>');
      expect(dteFactura.xmlDte).toContain('<DirRecep>CALLE INDUSTRIAL 456</DirRecep>');
      expect(dteFactura.xmlDte).toContain('<CmnaRecep>PUDAHUEL</CmnaRecep>');
    });
  });

  describe('4. Notas de Crédito Electrónicas (DTE Tipo 61) con nodo <Referencia>', () => {
    it('debe emitir Nota de Crédito 61 referenciando el DTE original según Ley Pro-Consumidor', () => {
      const dteNC = defaultDteEmitter.emitDocument({
        tenantId: TEST_TENANT,
        tipoDte: TipoDTE.NOTA_CREDITO,
        metodoPago: 'EFECTIVO',
        items: [
          {
            nroLinea: 1,
            nombre: 'Producto Devuelto por Falla Técnica',
            cantidad: 1,
            precioUnitario: 11900,
            subtotal: 11900
          }
        ],
        referencia: {
          nroLineaRef: 1,
          tipoDocRef: 39,
          folioRef: 105,
          fechaRef: '2026-09-01',
          codigoRef: 1, // 1: Anula Documento de Referencia
          razonRef: 'Garantía Legal Ley N° 21.398 (Falla de fábrica)'
        }
      });

      expect(dteNC.tipoDocumento).toBe('NOTA_CREDITO');
      expect(dteNC.tipoDte).toBe(61);
      expect(dteNC.xmlDte).toContain('<TipoDTE>61</TipoDTE>');
      expect(dteNC.xmlDte).toContain('<Referencia>');
      expect(dteNC.xmlDte).toContain('<TpoDocRef>39</TpoDocRef>');
      expect(dteNC.xmlDte).toContain('<FolioRef>105</FolioRef>');
      expect(dteNC.xmlDte).toContain('<CodRef>1</CodRef>');
      expect(dteNC.xmlDte).toContain('Garantía Legal Ley N° 21.398');
    });
  });

  describe('5. Guía de Despacho Electrónica (DTE Tipo 52)', () => {
    it('debe emitir Guía de Despacho 52 con indicador de traslado y datos de transporte', () => {
      const guia = defaultDteEmitter.emitDocument({
        tenantId: TEST_TENANT,
        tipoDte: TipoDTE.GUIA_DESPACHO,
        metodoPago: 'EFECTIVO',
        items: [
          {
            nroLinea: 1,
            nombre: 'Cajas de Mercadería para Traslado Sucursal',
            cantidad: 10,
            precioUnitario: 5000,
            subtotal: 50000
          }
        ],
        receptor: {
          rut: '76.123.456-7',
          razonSocial: 'ALMACEN DON TITO SUCURSAL 2',
          direccion: 'AV. PROVIDENCIA 999',
          comuna: 'PROVIDENCIA'
        },
        transporte: {
          indTraslado: 5, // 5: Traslado interno no venta
          patente: 'JJXX88',
          choferRut: '15.234.567-8',
          choferNombre: 'Mario González Chofer',
          direccionDestino: 'AV. PROVIDENCIA 999',
          comunaDestino: 'PROVIDENCIA'
        }
      });

      expect(guia.tipoDte).toBe(52);
      expect(guia.xmlDte).toContain('<TipoDTE>52</TipoDTE>');
      expect(guia.xmlDte).toContain('<IndTraslado>5</IndTraslado>');
      expect(guia.xmlDte).toContain('<Transporte>');
      expect(guia.xmlDte).toContain('<Patente>JJXX88</Patente>');
      expect(guia.xmlDte).toContain('<RUTChofer>15.234.567-8</RUTChofer>');
      expect(guia.xmlDte).toContain('<NombreChofer>Mario González Chofer</NombreChofer>');
    });
  });

  describe('6. Pre-Liquidación Mensual Formulario 29 (F29)', () => {
    it('debe calcular el Débito Fiscal, Crédito Fiscal, IVA Determinado y PPM', () => {
      const currentMonth = new Date().toISOString().substring(0, 7);
      const f29 = defaultF29ReportService.generateMonthlyF29(TEST_TENANT, currentMonth, 1.5);

      expect(f29.periodo).toBe(currentMonth);
      expect(f29.tenantId).toBe(TEST_TENANT);
      expect(f29.debitoFiscal.totalNeto).toBeDefined();
      expect(f29.debitoFiscal.totalIvaDebito).toBeDefined();
      expect(f29.creditoFiscal.totalIvaCredito).toBeDefined();
      expect(f29.balance.tasaPpm).toBe(1.5);
      expect(f29.balance.totalImpuestoPagarF29).toBeGreaterThanOrEqual(0);
    });
  });

  describe('7. Control Sanitario de Vencimientos (D.S. N° 977/96 MINSAL)', () => {
    it('debe persistir lote y fecha de vencimiento y consultarlos correctamente', () => {
      const prodId = uuidv4();
      const fechaVenceProxima = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      defaultSqliteClient.execute(
        `INSERT INTO productos 
         (id, tenant_id, sku, nombre, precio_compra, precio_venta, lote, fecha_vencimiento, activo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [prodId, TEST_TENANT, `LECHE-${Date.now()}`, 'Leche Entera Colun 1L', 700, 1050, 'LOTE-2026-X', fechaVenceProxima]
      );

      const prod = defaultSqliteClient.queryOne<any>(
        `SELECT id, lote, fecha_vencimiento, ROUND(julianday(fecha_vencimiento) - julianday('now')) as dias
         FROM productos WHERE id = ?`,
        [prodId]
      );

      expect(prod).not.toBeNull();
      expect(prod.lote).toBe('LOTE-2026-X');
      expect(prod.fecha_vencimiento).toBe(fechaVenceProxima);
      expect(Number(prod.dias)).toBeGreaterThanOrEqual(4);
      expect(Number(prod.dias)).toBeLessThanOrEqual(6);
    });
  });
});

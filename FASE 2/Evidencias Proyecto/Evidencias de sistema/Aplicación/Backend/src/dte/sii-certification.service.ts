// ============================================================================
// GesTock SII Technical Certification Service (Resolución Exenta N° 74)
// Homologación de Software ante el SII (Ambiente de Certificación Maullin)
// ============================================================================

import { defaultDteEmitter } from './dte-emitter.service';
import { defaultCafManager } from './caf-manager.service';
import { defaultRcofService } from './rcof.service';
import { TipoDTE, SiiCertificationResult } from './types';
import { logger } from '../utils/logger';
import { defaultSqliteClient } from '../database/sqlite/client';
import { fechaLocal } from '../utils/fecha-local';

export class SiiCertificationService {
  /**
   * Ejecuta el Set de Prueba Oficial de Certificación Técnica (Res. Ex. N° 74)
   * Valida Tipos 39 (Boleta Afecta), 41 (Boleta Exenta) y 61 (Nota de Crédito)
   */
  public async runFullCertificationSuite(tenantId: string): Promise<{
    success: boolean;
    ambiente: string;
    urlSii: string;
    resultados: SiiCertificationResult[];
    resumen: string;
  }> {
    logger.info('SiiCertification', `Iniciando suite de homologación técnica para tenant ${tenantId}...`);
    const resultados: SiiCertificationResult[] = [];

    // El set gasta folios y deja documentos: con folios del SII serian folios reales quemados
    const cafDelSii = defaultSqliteClient.queryOne<{ tipo_dte: number }>(
      `SELECT tipo_dte FROM sii_caf
        WHERE tenant_id = ? AND tipo_dte IN (39, 41, 61) AND origen = 'SII' AND activo = 1
          AND ultimo_folio_usado < folio_hasta
        LIMIT 1`,
      [tenantId]
    );
    if (cafDelSii) {
      return {
        success: false,
        ambiente: 'CERTIFICACION_SII_MAULLIN',
        urlSii: 'https://maullin.sii.cl',
        resultados,
        resumen: `El set de prueba no se ejecuto: el tipo ${cafDelSii.tipo_dte} tiene folios autorizados por el SII cargados, y el set los gastaria.`
      };
    }
    // los documentos del set quedan anulados: no van al envio, al RCOF ni al F29
    const anularDelSet = (dteId?: string) => {
      if (dteId) defaultSqliteClient.execute("UPDATE sii_dte_emitidos SET estado_sii = 'ANULADO' WHERE id = ?", [dteId]);
    };
    let folioBoleta: number | null = null;

    // Asegurar CAFs de certificación para cada tipo
    defaultCafManager.getOrCreateActiveCaf(tenantId, TipoDTE.BOLETA_ELECTRONICA);
    defaultCafManager.getOrCreateActiveCaf(tenantId, TipoDTE.BOLETA_EXENTA);
    defaultCafManager.getOrCreateActiveCaf(tenantId, TipoDTE.NOTA_CREDITO);

    // 1. Caso 1: Boleta Electrónica Afecta (Tipo 39) - Canasta básica con IVA
    try {
      const resp39 = defaultDteEmitter.emitDocument({
        tenantId,
        tipoDte: TipoDTE.BOLETA_ELECTRONICA,
        emisor: defaultDteEmitter.getTenantFiscalConfig(tenantId).emisor,
        receptor: {
          rut: '66666666-6',
          razonSocial: 'CONSUMIDOR FINAL PRUEBA SII',
          giro: 'PARTICULAR'
        },
        items: [
          { nroLinea: 1, nombre: 'Producto Prueba Homologacion Afecto 1', cantidad: 2, precioUnitario: 1500, subtotal: 3000 },
          { nroLinea: 2, nombre: 'Producto Prueba Homologacion Afecto 2', cantidad: 1, precioUnitario: 2490, subtotal: 2490 }
        ],
        metodoPago: 'EFECTIVO',
        modeloEmision: 'MODELO_A'
      });

      anularDelSet(resp39.dteId);
      folioBoleta = resp39.folio ?? null;
      const validTed = resp39.tedXml?.includes('<TED') && resp39.tedXml?.includes('<FRMT');
      const validXml = resp39.xmlDte?.includes('<DTE') && resp39.xmlDte?.includes('<Signature');

      resultados.push({
        suiteName: 'Caso 1: Emisión Boleta Afecta Tipo 39 (Res. 74)',
        passed: !!(resp39.esTributarioDte && validTed && validXml),
        tipoDte: TipoDTE.BOLETA_ELECTRONICA,
        foliosGenerados: [resp39.folio || 0],
        xmlOutputs: [resp39.xmlDte || ''],
        detalles: `Folio ${resp39.folio} emitido con TED firmado (${resp39.totales.montoTotal} CLP). El XML lleva timbre y firma; queda anulado, fuera del envio y de los reportes.`,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      resultados.push({
        suiteName: 'Caso 1: Emisión Boleta Afecta Tipo 39 (Res. 74)',
        passed: false,
        tipoDte: TipoDTE.BOLETA_ELECTRONICA,
        foliosGenerados: [],
        xmlOutputs: [],
        detalles: `Error: ${err.message}`,
        timestamp: new Date().toISOString()
      });
    }

    // 2. Caso 2: Boleta Electrónica Exenta (Tipo 41) - Venta sin IVA
    try {
      const resp41 = defaultDteEmitter.emitDocument({
        tenantId,
        tipoDte: TipoDTE.BOLETA_EXENTA,
        emisor: defaultDteEmitter.getTenantFiscalConfig(tenantId).emisor,
        receptor: {
          rut: '66666666-6',
          razonSocial: 'CONSUMIDOR FINAL PRUEBA SII',
          giro: 'PARTICULAR'
        },
        items: [
          { nroLinea: 1, nombre: 'Servicio / Bien Exento de IVA', cantidad: 1, precioUnitario: 5000, subtotal: 5000, exento: true }
        ],
        metodoPago: 'EFECTIVO',
        modeloEmision: 'MODELO_A'
      });

      anularDelSet(resp41.dteId);
      resultados.push({
        suiteName: 'Caso 2: Emisión Boleta Exenta Tipo 41 (Res. 74)',
        passed: !!(resp41.esTributarioDte && resp41.folio),
        tipoDte: TipoDTE.BOLETA_EXENTA,
        foliosGenerados: [resp41.folio || 0],
        xmlOutputs: [resp41.xmlDte || ''],
        detalles: `Folio ${resp41.folio} emitido con monto exento ${resp41.totales.montoExento} CLP.`,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      resultados.push({
        suiteName: 'Caso 2: Emisión Boleta Exenta Tipo 41 (Res. 74)',
        passed: false,
        tipoDte: TipoDTE.BOLETA_EXENTA,
        foliosGenerados: [],
        xmlOutputs: [],
        detalles: `Error: ${err.message}`,
        timestamp: new Date().toISOString()
      });
    }

    // 3. Caso 3: Nota de Crédito Electrónica (Tipo 61)
    try {
      const resp61 = defaultDteEmitter.emitDocument({
        tenantId,
        tipoDte: TipoDTE.NOTA_CREDITO,
        emisor: defaultDteEmitter.getTenantFiscalConfig(tenantId).emisor,
        receptor: {
          rut: '66666666-6',
          razonSocial: 'CLIENTE ANULACION',
          giro: 'PARTICULAR'
        },
        items: [
          { nroLinea: 1, nombre: 'Anulación de Venta Referencia Boleta', cantidad: 1, precioUnitario: 1000, subtotal: 1000 }
        ],
        metodoPago: 'EFECTIVO',
        modeloEmision: 'MODELO_A',
        ...(folioBoleta ? {
          referencia: {
            nroLineaRef: 1,
            tipoDocRef: TipoDTE.BOLETA_ELECTRONICA,
            folioRef: folioBoleta,
            fechaRef: fechaLocal(),
            codigoRef: 1,
            razonRef: 'Anula la boleta del caso 1 del set de prueba'
          }
        } : {})
      });
      anularDelSet(resp61.dteId);

      resultados.push({
        suiteName: 'Caso 3: Emisión Nota de Crédito Tipo 61 (Res. 74)',
        passed: !!(resp61.esTributarioDte && resp61.folio),
        tipoDte: TipoDTE.NOTA_CREDITO,
        foliosGenerados: [resp61.folio || 0],
        xmlOutputs: [resp61.xmlDte || ''],
        detalles: `Folio ${resp61.folio} emitido para corrección/anulación tributaria.`,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      resultados.push({
        suiteName: 'Caso 3: Emisión Nota de Crédito Tipo 61 (Res. 74)',
        passed: false,
        tipoDte: TipoDTE.NOTA_CREDITO,
        foliosGenerados: [],
        xmlOutputs: [],
        detalles: `Error: ${err.message}`,
        timestamp: new Date().toISOString()
      });
    }

    // 4. Caso 4: Generación RCOF (Consumo de Folios Diario)
    try {
      const rcof = defaultRcofService.generateDailyRcof(tenantId);
      resultados.push({
        suiteName: 'Caso 4: Generación y Firma RCOF Diario (RCV)',
        passed: !!(rcof.xmlRcof && rcof.xmlRcof.includes('<ConsumoFolios')),
        tipoDte: 0,
        foliosGenerados: [],
        xmlOutputs: [rcof.xmlRcof],
        detalles: `RCOF Secuencia ${rcof.secuencia} generado exitosamente (${rcof.cantidadBoletas} boletas agrupadas).`,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      resultados.push({
        suiteName: 'Caso 4: Generación y Firma RCOF Diario (RCV)',
        passed: false,
        tipoDte: 0,
        foliosGenerados: [],
        xmlOutputs: [],
        detalles: `Error: ${err.message}`,
        timestamp: new Date().toISOString()
      });
    }

    const allPassed = resultados.every(r => r.passed);

    return {
      success: allPassed,
      ambiente: 'CERTIFICACION_SII_MAULLIN',
      urlSii: 'https://maullin.sii.cl',
      resultados,
      resumen: allPassed
        ? 'Todos los casos del Set de Prueba Técnico se emitieron con su timbre y su firma, y quedaron anulados. La validación contra los esquemas oficiales del SII la hacen las pruebas automáticas, no este set.'
        : 'Se detectaron fallos en uno o más casos de la suite de certificación técnica.'
    };
  }
}

export const defaultSiiCertification = new SiiCertificationService();

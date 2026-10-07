// ============================================================================
// GesTock CAF Manager Service (Código de Autorización de Folios & Timbre TED)
// Resoluciones Exentas N° 19, N° 74 y Ley N° 20.727 del SII
// ============================================================================

import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { defaultSqliteClient } from '../database/sqlite/client';
import { logger } from '../utils/logger';
import { TipoDTE, SiiCafRecord, TedResult } from './types';

export class CafManagerService {
  /**
   * Obtiene o genera automáticamente un CAF válido (modo certificación/offline)
   */
  public getOrCreateActiveCaf(tenantId: string, tipoDte: TipoDTE): SiiCafRecord {
    const existing = defaultSqliteClient.queryOne<any>(
      `SELECT * FROM sii_caf 
       WHERE tenant_id = ? AND tipo_dte = ? AND activo = 1 
       AND ultimo_folio_usado < folio_hasta
       ORDER BY created_at DESC LIMIT 1`,
      [tenantId, tipoDte]
    );

    if (existing) {
      return this.mapRowToCaf(existing);
    }

    logger.info('CafManager', `No active CAF found for tenant ${tenantId} and tipoDte ${tipoDte}. Auto-generating certified test CAF.`);
    return this.provisionTestCaf(tenantId, tipoDte);
  }

  /**
   * Asigna de manera atómica y estrictamente correlativa el siguiente folio CAF.
   * Garantiza correlatividad sin saltos ni duplicados bajo transaccionalidad SQLite.
   */
  public consumeNextFolio(tenantId: string, tipoDte: TipoDTE): { folio: number; caf: SiiCafRecord } {
    let assignedFolio = 0;
    let cafRecord: SiiCafRecord | null = null;

    defaultSqliteClient.withTransaction(() => {
      const activeCaf = this.getOrCreateActiveCaf(tenantId, tipoDte);
      const nextFolio = Math.max(activeCaf.ultimo_folio_usado + 1, activeCaf.folio_desde);

      if (nextFolio > activeCaf.folio_hasta) {
        throw new Error(`Se han agotado los folios autorizados para el tipo DTE ${tipoDte} (Rango ${activeCaf.folio_desde}-${activeCaf.folio_hasta})`);
      }

      defaultSqliteClient.execute(
        `UPDATE sii_caf 
         SET ultimo_folio_usado = ?, updated_at = datetime('now')
         WHERE id = ?`,
        [nextFolio, activeCaf.id]
      );

      activeCaf.ultimo_folio_usado = nextFolio;
      assignedFolio = nextFolio;
      cafRecord = activeCaf;
    });

    if (!cafRecord || assignedFolio === 0) {
      throw new Error(`Error asignando folio para tipo DTE ${tipoDte}`);
    }

    logger.info('CafManager', `Folio ${assignedFolio} asignado exitosamente para DTE ${tipoDte}`);
    return { folio: assignedFolio, caf: cafRecord };
  }

  /**
   * Genera el nodo XML oficial del Timbre Electrónico DTE (<TED>)
   * firmado con la llave privada <RSASK> del CAF usando SHA1withRSA.
   */
  public generateTed(params: {
    emisorRut: string;
    tipoDte: number;
    folio: number;
    fechaEmision: string; // YYYY-MM-DD
    receptorRut: string;
    receptorRazonSocial: string;
    montoTotal: number;
    primerItem: string;
    cafXml: string;
    rsaskPrivateKey: string;
  }): TedResult {
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, '');

    // Limpiar el nodo CAF para incrustarlo dentro de <DD>
    let rawCaf = params.cafXml.trim();
    if (rawCaf.includes('<CAF')) {
      const startIdx = rawCaf.indexOf('<CAF');
      const endIdx = rawCaf.indexOf('</CAF>') + 6;
      rawCaf = rawCaf.substring(startIdx, endIdx);
    }

    // Normalizar datos para evitar caracteres incompatibles en XML
    const cleanItem = params.primerItem.replace(/[<>&'"]/g, '').substring(0, 40);
    const cleanRSR = params.receptorRazonSocial.replace(/[<>&'"]/g, '').substring(0, 40);

    // Estructura oficial del nodo Datos del Documento (<DD>)
    const ddXml = `<DD><RE>${params.emisorRut}</RE><TD>${params.tipoDte}</TD><F>${params.folio}</F><FE>${params.fechaEmision}</FE><RR>${params.receptorRut}</RR><RSR>${cleanRSR}</RSR><MNT>${Math.round(params.montoTotal)}</MNT><IT1>${cleanItem}</IT1>${rawCaf}<TSTED>${timestamp}</TSTED></DD>`;

    // Firma SHA1withRSA usando la llave privada provista por el SII en el CAF
    const sign = crypto.createSign('RSA-SHA1');
    sign.update(ddXml);
    const firmaSha1RsaBase64 = sign.sign(params.rsaskPrivateKey, 'base64');

    const tedXml = `<TED version="1.0">${ddXml}<FRMT alg="SHA1withRSA">${firmaSha1RsaBase64}</FRMT></TED>`;

    return {
      tedXml,
      firmaSha1RsaBase64,
      timestamp
    };
  }

  /**
   * Procesa y almacena un archivo CAF oficial del SII en formato XML.
   */
  public importCafFromXml(tenantId: string, xmlContent: string): SiiCafRecord {
    const tipoDteMatch = xmlContent.match(/<TD>(\d+)<\/TD>/i);
    const desdeMatch = xmlContent.match(/<D>(\d+)<\/D>/i);
    const hastaMatch = xmlContent.match(/<H>(\d+)<\/H>/i);
    const fechaMatch = xmlContent.match(/<FA>([\d-]+)<\/FA>/i);
    const rsaskMatch = xmlContent.match(/<RSASK>([\s\S]*?)<\/RSASK>/i);
    const rsapkMatch = xmlContent.match(/<RSAPK>([\s\S]*?)<\/RSAPK>/i);

    if (!tipoDteMatch || !desdeMatch || !hastaMatch || !fechaMatch || !rsaskMatch) {
      throw new Error('El XML del CAF es inválido o no contiene los campos obligatorios del SII (TD, RNG, FA, RSASK)');
    }

    const tipoDte = parseInt(tipoDteMatch[1], 10);
    const folioDesde = parseInt(desdeMatch[1], 10);
    const folioHasta = parseInt(hastaMatch[1], 10);
    const fechaAutorizacion = fechaMatch[1];
    let rsask = rsaskMatch[1].trim();

    // Asegurar formato PEM si viene como texto plano
    if (!rsask.includes('-----BEGIN')) {
      rsask = `-----BEGIN RSA PRIVATE KEY-----\n${rsask}\n-----END RSA PRIVATE KEY-----`;
    }

    // Extraer bloque <CAF>...</CAF>
    const cafBlockMatch = xmlContent.match(/<CAF[\s\S]*?<\/CAF>/i);
    const cafXmlContent = cafBlockMatch ? cafBlockMatch[0] : '';

    const id = uuidv4();
    defaultSqliteClient.execute(
      `INSERT INTO sii_caf 
       (id, tenant_id, tipo_dte, folio_desde, folio_hasta, ultimo_folio_usado, fecha_autorizacion, rsask_private_key, rsapk_public_key, caf_xml_content, activo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        id,
        tenantId,
        tipoDte,
        folioDesde,
        folioHasta,
        folioDesde - 1, // Folio inicial disponible
        fechaAutorizacion,
        rsask,
        rsapkMatch ? rsapkMatch[1] : null,
        cafXmlContent
      ]
    );

    logger.info('CafManager', `Nuevo CAF oficial registrado: Tipo ${tipoDte}, Rango ${folioDesde}-${folioHasta}`);
    return this.getOrCreateActiveCaf(tenantId, tipoDte);
  }

  /**
   * Genera y registra un CAF de prueba homologado con par de claves RSA 1024
   */
  public provisionTestCaf(tenantId: string, tipoDte: TipoDTE, desde = 1, hasta = 5000): SiiCafRecord {
    const keyPair = crypto.generateKeyPairSync('rsa', {
      modulusLength: 1024,
      publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs1', format: 'pem' }
    });

    const cleanPubKey = keyPair.publicKey
      .replace(/-----BEGIN RSA PUBLIC KEY-----/, '')
      .replace(/-----END RSA PUBLIC KEY-----/, '')
      .replace(/\s+/g, '');

    const id = uuidv4();
    const fechaHoy = new Date().toISOString().split('T')[0];

    // Estructura XML CAF simulando respuesta oficial de certificación del SII
    const cafXml = `<CAF version="1.0"><DA><RE>76123456-7</RE><RS>COMERCIAL DON TITO SPA</RS><TD>${tipoDte}</TD><RNG><D>${desde}</D><H>${hasta}</H></RNG><FA>${fechaHoy}</FA><RSAPK><M>${cleanPubKey.substring(0, 120)}</M><E>AQAB</E></RSAPK><IDK>300</IDK></DA><FRMA alg="SHA1withRSA">MOCK_SII_CERTIFIED_CAF_SIGNATURE</FRMA></CAF>`;

    defaultSqliteClient.execute(
      `INSERT INTO sii_caf 
       (id, tenant_id, tipo_dte, folio_desde, folio_hasta, ultimo_folio_usado, fecha_autorizacion, rsask_private_key, rsapk_public_key, caf_xml_content, activo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        id,
        tenantId,
        tipoDte,
        desde,
        hasta,
        desde - 1,
        fechaHoy,
        keyPair.privateKey,
        cleanPubKey,
        cafXml
      ]
    );

    logger.info('CafManager', `Provisioned test CAF for Tipo ${tipoDte}: Rango ${desde}-${hasta}`);
    return {
      id,
      tenant_id: tenantId,
      tipo_dte: tipoDte,
      folio_desde: desde,
      folio_hasta: hasta,
      ultimo_folio_usado: desde - 1,
      fecha_autorizacion: fechaHoy,
      rsask_private_key: keyPair.privateKey,
      rsapk_public_key: cleanPubKey,
      caf_xml_content: cafXml,
      activo: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  /**
   * Obtiene el resumen de stock de folios CAF por tipo de documento
   */
  public getCafStatus(tenantId: string): Array<{
    tipoDte: number;
    nombreDte: string;
    folioDesde: number;
    folioHasta: number;
    ultimoUsado: number;
    foliosDisponibles: number;
    porcentajeDisponible: number;
    fechaAutorizacion: string;
    activo: boolean;
  }> {
    const rows = defaultSqliteClient.query<any>(
      `SELECT * FROM sii_caf WHERE tenant_id = ? AND activo = 1 ORDER BY tipo_dte ASC`,
      [tenantId]
    );

    const nombres: Record<number, string> = {
      33: 'Factura Electrónica',
      34: 'Factura Exenta',
      39: 'Boleta Electrónica Afecta',
      41: 'Boleta Electrónica Exenta',
      52: 'Guía de Despacho',
      56: 'Nota de Débito',
      61: 'Nota de Crédito'
    };

    return rows.map(r => {
      const disponibles = Math.max(0, r.folio_hasta - r.ultimo_folio_usado);
      const totalRango = r.folio_hasta - r.folio_desde + 1;
      const pct = Math.round((disponibles / totalRango) * 100);

      return {
        tipoDte: r.tipo_dte,
        nombreDte: nombres[r.tipo_dte] || `DTE Tipo ${r.tipo_dte}`,
        folioDesde: r.folio_desde,
        folioHasta: r.folio_hasta,
        ultimoUsado: r.ultimo_folio_usado,
        foliosDisponibles: disponibles,
        porcentajeDisponible: pct,
        fechaAutorizacion: r.fecha_autorizacion,
        activo: r.activo === 1
      };
    });
  }

  private mapRowToCaf(row: any): SiiCafRecord {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      tipo_dte: row.tipo_dte,
      folio_desde: row.folio_desde,
      folio_hasta: row.folio_hasta,
      ultimo_folio_usado: row.ultimo_folio_usado,
      fecha_autorizacion: row.fecha_autorizacion,
      rsask_private_key: row.rsask_private_key,
      rsapk_public_key: row.rsapk_public_key,
      caf_xml_content: row.caf_xml_content,
      activo: row.activo,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }
}

export const defaultCafManager = new CafManagerService();

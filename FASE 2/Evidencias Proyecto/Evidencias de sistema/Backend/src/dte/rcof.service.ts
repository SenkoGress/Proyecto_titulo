// ============================================================================
// GesTock RCOF Service (Registro de Consumo de Folios / Registro Diario Boletas)
// Cumplimiento Resolución Exenta N° 74 y Registro de Compras y Ventas (RCV) SII
// ============================================================================

import { v4 as uuidv4 } from 'uuid';
import { defaultSqliteClient } from '../database/sqlite/client';
import { logger } from '../utils/logger';
import { defaultXmlSigner } from './xml-signer.service';
import { defaultDteEmitter } from './dte-emitter.service';
import { RcofDaySummary } from './types';

export class RcofService {
  /**
   * Genera el archivo XML oficial de Consumo de Folios (RCOF) para el SII
   * agrupando todas las boletas electrónicas emitidas en la fecha indicada.
   */
  public generateDailyRcof(tenantId: string, fechaReporte?: string): RcofDaySummary {
    const fecha = fechaReporte || new Date().toISOString().split('T')[0];
    const { emisor } = defaultDteEmitter.getTenantFiscalConfig(tenantId);

    // Obtener boletas del día emitidas
    const boletas = defaultSqliteClient.query<any>(
      `SELECT folio, monto_neto, monto_iva, monto_exento, monto_total
       FROM sii_dte_emitidos 
       WHERE tenant_id = ? AND tipo_dte = 39 
       AND strftime('%Y-%m-%d', fecha_emision) = ?
       ORDER BY folio ASC`,
      [tenantId, fecha]
    );

    let cantidad = boletas.length;
    let montoNeto = 0;
    let montoIva = 0;
    let montoExento = 0;
    let montoTotal = 0;
    let folioInicial = 0;
    let folioFinal = 0;

    if (cantidad > 0) {
      folioInicial = boletas[0].folio;
      folioFinal = boletas[boletas.length - 1].folio;
      for (const b of boletas) {
        montoNeto += Math.round(b.monto_neto);
        montoIva += Math.round(b.monto_iva);
        montoExento += Math.round(b.monto_exento);
        montoTotal += Math.round(b.monto_total);
      }
    }

    // Determinar correlativo de secuencia de envío para la fecha
    const prevCount = defaultSqliteClient.queryOne<{ count: number }>(
      `SELECT count(*) as count FROM sii_rcof_registros WHERE tenant_id = ? AND fecha_reporte = ?`,
      [tenantId, fecha]
    );
    const secuencia = (prevCount?.count || 0) + 1;

    const docId = `RCOF_${fecha.replace(/-/g, '')}_SEQ${secuencia}`;
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, '');

    // Construcción XML oficial del Documento de Consumo de Folios
    const documentoXml = `<DocumentoConsumoFolios ID="${docId}"><Caratula><RutEmisor>${emisor.rut}</RutEmisor><FchInicio>${fecha}</FchInicio><FchFinal>${fecha}</FchFinal><Correlativo>${secuencia}</Correlativo><Secuencia>${secuencia}</Secuencia><TmstFirmaEnv>${timestamp}</TmstFirmaEnv></Caratula><Resumen><TipoDocumento>39</TipoDocumento><MntNeto>${montoNeto}</MntNeto><MntIva>${montoIva}</MntIva><TasaIVA>19</TasaIVA><MntExento>${montoExento}</MntExento><MntTotal>${montoTotal}</MntTotal><FoliosEmitidos>${cantidad}</FoliosEmitidos><FoliosAnulados>0</FoliosAnulados><RangoFolios><Inicial>${folioInicial}</Inicial><Final>${folioFinal}</Final></RangoFolios></Resumen></DocumentoConsumoFolios>`;

    // Firma digital XMLDSig
    const signatureXml = defaultXmlSigner.signDocument(documentoXml, docId);
    const fullRcofXml = `<ConsumoFolios version="1.0" xmlns="http://www.sii.cl/SiiDte">${documentoXml}${signatureXml}</ConsumoFolios>`;

    // Guardar en sii_rcof_registros
    const rcofId = uuidv4();
    defaultSqliteClient.execute(
      `INSERT INTO sii_rcof_registros 
       (id, tenant_id, fecha_reporte, secuencia_envio, cantidad_boletas, total_neto, total_iva, total_exento, total_ventas, rcof_xml_content, estado_envio)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDIENTE')`,
      [
        rcofId,
        tenantId,
        fecha,
        secuencia,
        cantidad,
        montoNeto,
        montoIva,
        montoExento,
        montoTotal,
        fullRcofXml
      ]
    );

    logger.info('RcofService', `RCOF generado exitosamente para la fecha ${fecha} (Secuencia ${secuencia}, Boletas: ${cantidad}, Total: $${montoTotal})`);

    return {
      fechaReporte: fecha,
      secuencia,
      cantidadBoletas: cantidad,
      montoNeto,
      montoIva,
      montoExento,
      montoTotal,
      folioInicial,
      folioFinal,
      xmlRcof: fullRcofXml
    };
  }

  /**
   * Lista los registros RCOF generados
   */
  public listRcofRecords(tenantId: string, limit = 30): any[] {
    return defaultSqliteClient.query<any>(
      `SELECT id, fecha_reporte, secuencia_envio, cantidad_boletas, total_neto, total_iva, total_ventas, estado_envio, created_at
       FROM sii_rcof_registros 
       WHERE tenant_id = ? 
       ORDER BY fecha_reporte DESC, secuencia_envio DESC LIMIT ?`,
      [tenantId, limit]
    );
  }
}

export const defaultRcofService = new RcofService();

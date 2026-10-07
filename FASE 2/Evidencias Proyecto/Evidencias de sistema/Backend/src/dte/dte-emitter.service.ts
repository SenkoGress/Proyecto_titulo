// ============================================================================
// GesTock DTE Emitter Service (Emisión de Boletas Electrónicas & Regla Res. 176)
// Ley N° 20.727, Res. Ex. N° 53, Res. Ex. N° 74, Res. Ex. N° 176 y Ley N° 20.956
// ============================================================================

import { v4 as uuidv4 } from 'uuid';
import { defaultSqliteClient } from '../database/sqlite/client';
import { logger } from '../utils/logger';
import { defaultCafManager } from './caf-manager.service';
import { defaultXmlSigner } from './xml-signer.service';
import {
  TipoDTE,
  TipoDocumentoVenta,
  SiiModeloEmision,
  EmisorFiscal,
  ReceptorFiscal,
  ItemDTE,
  TotalesDTE,
  EmisionDteRequest,
  EmisionDteResponse
} from './types';

export class DteEmitterService {
  /**
   * Obtiene la configuración tributaria activa del tenant
   */
  public getTenantFiscalConfig(tenantId: string): {
    modeloEmision: SiiModeloEmision;
    emisor: EmisorFiscal;
  } {
    const configRows = defaultSqliteClient.query<any>(
      `SELECT clave, valor FROM configuracion_sistema WHERE tenant_id = ?`,
      [tenantId]
    );

    const map: Record<string, string> = {};
    for (const r of configRows) {
      map[r.clave] = r.valor;
    }

    const modeloEmision = (map['sii_modelo_emision'] as SiiModeloEmision) || 'MODELO_B';

    const emisor: EmisorFiscal = {
      rut: map['sii_rut_emisor'] || '76.123.456-7',
      razonSocial: map['sii_razon_social'] || 'ALMACEN DON TITO SPA',
      giro: map['sii_giro_comercial'] || 'VENTA AL POR MENOR EN ALMACENES Y MINIMARKET',
      acteco: map['sii_acteco'] || '471100',
      direccion: map['sii_direccion'] || 'AV. LIBERTADOR BERNARDO OHIGGINS 1234',
      comuna: map['sii_comuna'] || 'SANTIAGO',
      ciudad: map['sii_ciudad'] || 'SANTIAGO',
      telefono: map['sii_telefono'] || '+56911223344',
      correoEmisor: map['sii_correo_contacto'] || 'contacto@almacendontito.cl'
    };

    return { modeloEmision, emisor };
  }

  /**
   * Calcula los totales respetando el IVA del 19% y la Ley de Redondeo N° 20.956
   */
  /**
   * Calcula los totales respetando el IVA del 19%, ILA y la Ley de Redondeo N° 20.956
   */
  public calculateTotals(items: ItemDTE[]): TotalesDTE {
    let netoTotal = 0;
    let ivaTotal = 0;
    let exentoTotal = 0;
    let ilaTotal = 0;
    let totalBruto = 0;
    const desgloseMap: Record<number, { codigo: number; nombre: string; tasa: number; monto: number }> = {};

    const nombresIla: Record<number, string> = {
      25: 'ILA Analcohólica Azúcar Baja (10%)',
      26: 'ILA Analcohólica Azúcar Alta (18%)',
      27: 'ILA Cervezas y Vinos (20.5%)',
      28: 'ILA Licores y Destilados (31.5%)'
    };

    for (const it of items) {
      const sub = Math.round(it.cantidad * it.precioUnitario);
      if (it.exento) {
        exentoTotal += sub;
        totalBruto += sub;
      } else {
        const tasaIla = it.tasaIla || 0;
        const codigoIla = it.codigoIla || 0;
        const factorImpuestos = 1.19 + (tasaIla / 100);

        // Precios en catálogo chileno minorista son brutos (IVA + ILA incluidos)
        const neto = Math.round(sub / factorImpuestos);
        const iva = Math.round(neto * 0.19);
        const ila = Math.round(neto * (tasaIla / 100));

        netoTotal += neto;
        ivaTotal += iva;
        ilaTotal += ila;
        totalBruto += sub;

        if (codigoIla > 0 && ila > 0) {
          if (!desgloseMap[codigoIla]) {
            desgloseMap[codigoIla] = {
              codigo: codigoIla,
              nombre: nombresIla[codigoIla] || `Impuesto Adicional Cód ${codigoIla}`,
              tasa: tasaIla,
              monto: 0
            };
          }
          desgloseMap[codigoIla].monto += ila;
        }
      }
    }

    // Regla de Redondeo Ley N° 20.956 del Banco Central de Chile
    const ultimoDigito = totalBruto % 10;
    let redondeo = 0;
    if (ultimoDigito >= 1 && ultimoDigito <= 4) {
      redondeo = -ultimoDigito; // Redondeo hacia abajo
    } else if (ultimoDigito >= 5 && ultimoDigito <= 9) {
      redondeo = 10 - ultimoDigito; // Redondeo hacia arriba
    }
    const totalRedondeado = totalBruto + redondeo;

    return {
      montoNeto: netoTotal,
      tasaIva: 19.0,
      montoIva: ivaTotal,
      montoExento: exentoTotal,
      montoIla: ilaTotal,
      desgloseIla: Object.values(desgloseMap),
      montoTotal: totalRedondeado,
      redondeoChileno: redondeo
    };
  }

  /**
   * Emite el documento de venta correspondiente cumpliendo la Resolución Exenta N° 176
   */
  public emitDocument(req: EmisionDteRequest): EmisionDteResponse {
    const { modeloEmision: configuredModel, emisor: defaultEmisor } = this.getTenantFiscalConfig(req.tenantId);
    const modeloEmision = req.modeloEmision || configuredModel;
    const emisor = req.emisor || defaultEmisor;

    const receptor: ReceptorFiscal = req.receptor || {
      rut: '66666666-6',
      razonSocial: 'CLIENTE ANONIMO',
      giro: 'PARTICULAR',
      comuna: emisor.comuna,
      ciudad: emisor.ciudad
    };

    const totales = this.calculateTotals(req.items);
    const fecha = req.fechaEmision || new Date().toISOString().split('T')[0];
    const isPaymentCard = req.metodoPago.toUpperCase() !== 'EFECTIVO';
    const isDevolucion = req.tipoDte === TipoDTE.NOTA_CREDITO;
    const isFactura = req.tipoDte === TipoDTE.FACTURA_ELECTRONICA || req.tipoDte === TipoDTE.FACTURA_EXENTA;

    // Cumplimiento Resolucion Exenta N 176 del SII: Prevencion de doble debito tributario
    // Solo aplica para Boletas a consumidor final (no para Facturas ni Notas de Crédito)
    if (modeloEmision === 'MODELO_B' && isPaymentCard && !isFactura && !isDevolucion && req.tipoDte === TipoDTE.BOLETA_ELECTRONICA) {
      logger.info(
        'DteEmitter',
        `Res. Ex. N° 176 aplicada: Pago con tarjeta (${req.metodoPago}) en MODELO_B. Se omite emisión de boleta DTE Tipo 39 para evitar doble tributación.`
      );

      // Si existe venta_id, marcarla como VOUCHER_TRANSBANK
      if (req.ventaId) {
        defaultSqliteClient.execute(
          `UPDATE transacciones_venta 
           SET tipo_documento_tributario = 'VOUCHER_TRANSBANK', dte_folio = NULL, dte_id = NULL
           WHERE id = ?`,
          [req.ventaId]
        );
      }

      return {
        tipoDocumento: 'VOUCHER_TRANSBANK',
        esTributarioDte: false,
        mensajeLegal: 'Comprobante de Pago Electrónico. Voucher válido como Boleta Electrónica según Res. Exenta N° 176 del SII.',
        totales,
        emisor,
        receptor,
        items: req.items,
        fecha
      };
    }

    // ========================================================================
    // EMISIÓN FISCAL OFICIAL DTE (Tipo 33, 34, 39, 41, 52, 61)
    // ========================================================================
    const tipoDte = req.tipoDte || TipoDTE.BOLETA_ELECTRONICA;
    const primerItemNombre = req.items[0]?.nombre || 'Venta Minorista';

    // 1. Asignar folio correlativo atómico con el CAF activo
    const { folio, caf } = defaultCafManager.consumeNextFolio(req.tenantId, tipoDte);

    // 2. Generar Timbre Electrónico DTE (TED) con la llave <RSASK> del CAF
    const tedResult = defaultCafManager.generateTed({
      emisorRut: emisor.rut,
      tipoDte,
      folio,
      fechaEmision: fecha,
      receptorRut: receptor.rut,
      receptorRazonSocial: receptor.razonSocial,
      montoTotal: totales.montoTotal,
      primerItem: primerItemNombre,
      cafXml: caf.caf_xml_content,
      rsaskPrivateKey: caf.rsask_private_key
    });

    // 3. Construir el documento XML oficial DTE
    const docId = `DTE_${tipoDte}_F${folio}`;
    const tmstFirma = new Date().toISOString().replace(/\.\d{3}Z$/, '');

    let itemsXml = '';
    req.items.forEach((it, idx) => {
      const ilaTag = it.codigoIla ? `<CodImpAdic>${it.codigoIla}</CodImpAdic>` : '';
      itemsXml += `<Detalle><NroLinDet>${idx + 1}</NroLinDet>${ilaTag}<NmbItem>${it.nombre.replace(/[<>&'"]/g, '').substring(0, 50)}</NmbItem><QtyItem>${it.cantidad}</QtyItem><PrcItem>${Math.round(it.precioUnitario)}</PrcItem><MontoItem>${Math.round(it.subtotal)}</MontoItem></Detalle>`;
    });

    // Encabezado según tipo de documento
    let idDocExtra = '<IndServicio>3</IndServicio>';
    if (tipoDte === TipoDTE.GUIA_DESPACHO) {
      idDocExtra = `<IndTraslado>${req.transporte?.indTraslado || 5}</IndTraslado>`;
    }

    // Receptor corporativo para Facturas y Guías, o simple para boletas
    let receptorXml = '';
    if (isFactura || tipoDte === TipoDTE.GUIA_DESPACHO || receptor.giro) {
      receptorXml = `<Receptor><RUTRecep>${receptor.rut}</RUTRecep><RznSocRecep>${receptor.razonSocial.replace(/[<>&'"]/g, '')}</RznSocRecep><GiroRecep>${(receptor.giro || 'COMERCIO').replace(/[<>&'"]/g, '')}</GiroRecep><DirRecep>${(receptor.direccion || emisor.direccion).replace(/[<>&'"]/g, '')}</DirRecep><CmnaRecep>${receptor.comuna || emisor.comuna}</CmnaRecep><CiudadRecep>${receptor.ciudad || emisor.ciudad}</CiudadRecep></Receptor>`;
    } else {
      receptorXml = `<Receptor><RUTRecep>${receptor.rut}</RUTRecep><RznSocRecep>${receptor.razonSocial.replace(/[<>&'"]/g, '')}</RznSocRecep></Receptor>`;
    }

    // Totales con desglose de ILA si existe
    let ilaTotalesXml = '';
    if (totales.desgloseIla && totales.desgloseIla.length > 0) {
      for (const ila of totales.desgloseIla) {
        ilaTotalesXml += `<ImptoReten><TipoImp>${ila.codigo}</TipoImp><TasaImp>${ila.tasa}</TasaImp><MontoImp>${ila.monto}</MontoImp></ImptoReten>`;
      }
    }

    // Nodo Referencia para Notas de Crédito (Tipo 61) o documentos con referencia
    let referenciaXml = '';
    if (req.referencia) {
      referenciaXml = `<Referencia><NroLinRef>${req.referencia.nroLineaRef || 1}</NroLinRef><TpoDocRef>${req.referencia.tipoDocRef}</TpoDocRef><FolioRef>${req.referencia.folioRef}</FolioRef><FchRef>${req.referencia.fechaRef}</FchRef><CodRef>${req.referencia.codigoRef || 1}</CodRef><RazonRef>${req.referencia.razonRef.replace(/[<>&'"]/g, '')}</RazonRef></Referencia>`;
    }

    // Nodo Transporte para Guía de Despacho (Tipo 52)
    let transporteXml = '';
    if (tipoDte === TipoDTE.GUIA_DESPACHO && req.transporte) {
      transporteXml = `<Transporte><Patente>${req.transporte.patente || 'ABCD12'}</Patente><RUTTrans>${req.transporte.choferRut || emisor.rut}</RUTTrans><Chofer><RUTChofer>${req.transporte.choferRut || emisor.rut}</RUTChofer><NombreChofer>${(req.transporte.choferNombre || 'Chofer Asignado').replace(/[<>&'"]/g, '')}</NombreChofer></Chofer><DirDest>${(req.transporte.direccionDestino || receptor.direccion || 'Local Destino').replace(/[<>&'"]/g, '')}</DirDest><CmnaDest>${req.transporte.comunaDestino || receptor.comuna || emisor.comuna}</CmnaDest></Transporte>`;
    }

    const documentoXml = `<Documento ID="${docId}"><Encabezado><IdDoc><TipoDTE>${tipoDte}</TipoDTE><Folio>${folio}</Folio><FchEmis>${fecha}</FchEmis>${idDocExtra}</IdDoc><Emisor><RUTEmisor>${emisor.rut}</RUTEmisor><RznSoc>${emisor.razonSocial.replace(/[<>&'"]/g, '')}</RznSoc><GiroEmis>${emisor.giro.replace(/[<>&'"]/g, '')}</GiroEmis><Acteco>${emisor.acteco || '471100'}</Acteco><DirOrigen>${emisor.direccion.replace(/[<>&'"]/g, '')}</DirOrigen><CmnaOrigen>${emisor.comuna}</CmnaOrigen><CiudadOrigen>${emisor.ciudad}</CiudadOrigen></Emisor>${receptorXml}<Totales><MntNeto>${totales.montoNeto}</MntNeto><TasaIVA>19</TasaIVA><IVA>${totales.montoIva}</IVA>${ilaTotalesXml}<MntTotal>${totales.montoTotal}</MntTotal></Totales></Encabezado>${itemsXml}${transporteXml}${referenciaXml}${tedResult.tedXml}<TmstFirma>${tmstFirma}</TmstFirma></Documento>`;

    // 4. Firmar el XML con XMLDSig
    const signatureXml = defaultXmlSigner.signDocument(documentoXml, docId);
    const fullDteXml = `<DTE version="1.0" xmlns="http://www.sii.cl/SiiDte">${documentoXml}${signatureXml}</DTE>`;

    // 5. Construir URL QR oficial de verificación fiscal del SII (Res. Ex. N° 53)
    const cleanRutEmisor = emisor.rut.replace(/[^0-9kK]/g, '').toUpperCase();
    const qrUrl = `https://www.sii.cl/consulta_dte?rut=${cleanRutEmisor}&tipo=${tipoDte}&folio=${folio}&fecha=${fecha}&monto=${totales.montoTotal}&ted=${encodeURIComponent(tedResult.firmaSha1RsaBase64)}`;

    // 6. Guardar en sii_dte_emitidos
    const dteId = uuidv4();
    defaultSqliteClient.execute(
      `INSERT INTO sii_dte_emitidos 
       (id, tenant_id, venta_id, tipo_dte, folio, fecha_emision, rut_emisor, razon_social_emisor, rut_receptor, razon_social_receptor, monto_neto, monto_iva, monto_exento, monto_total, referencia_tipo_dte, referencia_folio, referencia_fecha, referencia_codigo, referencia_razon, monto_ila, ted_xml, dte_xml_completo, qr_code_content, estado_sii)
       VALUES (?, ?, ?, ?, ?, datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'EMITIDO_LOCAL')`,
      [
        dteId,
        req.tenantId,
        req.ventaId || null,
        tipoDte,
        folio,
        emisor.rut,
        emisor.razonSocial,
        receptor.rut,
        receptor.razonSocial,
        totales.montoNeto,
        totales.montoIva,
        totales.montoExento,
        totales.montoTotal,
        req.referencia?.tipoDocRef || null,
        req.referencia?.folioRef || null,
        req.referencia?.fechaRef || null,
        req.referencia?.codigoRef || null,
        req.referencia?.razonRef || null,
        totales.montoIla || 0,
        tedResult.tedXml,
        fullDteXml,
        qrUrl
      ]
    );

    // 7. Si hay venta_id, enlazar en transacciones_venta
    const tipoDocLabel: TipoDocumentoVenta = isFactura
      ? 'FACTURA'
      : isDevolucion
      ? 'NOTA_CREDITO'
      : 'BOLETA_ELECTRONICA';

    if (req.ventaId) {
      defaultSqliteClient.execute(
        `UPDATE transacciones_venta 
         SET tipo_documento_tributario = ?, dte_folio = ?, dte_id = ?, monto_ila = ?
         WHERE id = ?`,
        [tipoDocLabel, folio, dteId, totales.montoIla || 0, req.ventaId]
      );
    }

    logger.info('DteEmitter', `DTE Tipo ${tipoDte} Folio ${folio} (${tipoDocLabel}) emitido y registrado exitosamente.`);

    return {
      tipoDocumento: tipoDocLabel,
      esTributarioDte: true,
      dteId,
      folio,
      tipoDte,
      xmlDte: fullDteXml,
      tedXml: tedResult.tedXml,
      qrUrl,
      mensajeLegal: 'Documento Tributario Electrónico válido según Ley N° 20.727 y Resoluciones Técnicas del SII.',
      totales,
      emisor,
      receptor,
      items: req.items,
      referencia: req.referencia,
      transporte: req.transporte,
      fecha
    };
  }

  /**
   * Obtiene la lista de DTEs emitidos para la vista de ventas/tributaria
   */
  public listIssuedDtes(tenantId: string, limit = 50): any[] {
    return defaultSqliteClient.query<any>(
      `SELECT id, tipo_dte, folio, fecha_emision, rut_emisor, razon_social_emisor, rut_receptor, 
              monto_neto, monto_iva, monto_total, estado_sii, qr_code_content, venta_id
       FROM sii_dte_emitidos 
       WHERE tenant_id = ? 
       ORDER BY folio DESC LIMIT ?`,
      [tenantId, limit]
    );
  }

  /**
   * Obtiene el registro completo de un DTE por ID o por Folio
   */
  public getDteById(id: string): any {
    return defaultSqliteClient.queryOne<any>(
      `SELECT * FROM sii_dte_emitidos WHERE id = ?`,
      [id]
    );
  }
}

export const defaultDteEmitter = new DteEmitterService();

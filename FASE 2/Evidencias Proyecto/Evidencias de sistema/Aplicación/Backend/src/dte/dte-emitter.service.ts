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
import { fechaLocal, marcaLocal } from '../utils/fecha-local';
import { rutSii, textoSii } from '../utils/sii.utils';

/** Monto de una linea: la unica fuente del subtotal, para que el detalle y los totales coincidan. */
export function montoLinea(item: { cantidad: number; precioUnitario: number }): number {
  return Math.round(Number(item.cantidad) * Number(item.precioUnitario));
}

/** Tasa del impuesto adicional de un item: solo cuenta con codigo y tasa, que viajan juntos al XML. */
function tasaAdicional(item: ItemDTE): number {
  return Number(item.codigoIla) > 0 && Number(item.tasaIla) > 0 ? Number(item.tasaIla) : 0;
}

/** Neto de una linea bruta: sin IVA y, si lo lleva, sin impuesto adicional. */
function netoDeLinea(bruto: number, tasaIla: number): number {
  return Math.round(bruto / (1.19 + tasaIla / 100));
}

/** El formato del SII admite hasta 6 decimales en la cantidad y en el precio unitario. */
function decimalesSii(valor: number): string {
  return Number(valor.toFixed(6)).toFixed(6).replace(/\.?0+$/, '');
}

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

    const modeloEmision = (map['sii_modelo_emision'] as SiiModeloEmision) || 'MODELO_A';

    const rawRut = map['sii_rut_emisor'] || '76.123.456-0';
    const rutEmisor = rawRut === '76.123.456-7' ? '76.123.456-0' : rawRut;

    const emisor: EmisorFiscal = {
      rut: rutEmisor,
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
   * Totales del documento. Declaran el monto real de la venta: el redondeo de la Ley N° 20.956 es un
   * ajuste del pago en efectivo, no del documento, y con tarjeta se cobra exacto.
   *
   * Los precios del catalogo son brutos. neto + IVA + adicional + exento da el total exacto, porque el
   * IVA es lo que falta. conIla en false para la venta del minorista al consumidor (DL 825, art. 43
   * inciso final): el impuesto adicional ya viene en el costo y el precio solo se separa en neto e IVA.
   *
   * detalleNeto en true cuando el documento no admite montos brutos (guia, o lleva impuesto adicional):
   * el detalle se expresa en neto por linea y MntNeto tiene que ser su suma. En los demas, la boleta y
   * los documentos con MntBruto=1, el neto de lo afecto se saca una sola vez sobre el documento.
   */
  public calculateTotals(items: ItemDTE[], conIla = true, detalleNeto = false): TotalesDTE {
    let exentoTotal = 0;
    let afectoTotal = 0;
    let afectoSinIla = 0;
    let netoPorLinea = 0;
    let ilaTotal = 0;
    const desgloseMap: Record<number, { codigo: number; nombre: string; tasa: number; monto: number }> = {};

    // Codigos de la tabla del formato DTE del SII: son los que viajan en CodImpAdic
    const nombresIla: Record<number, string> = {
      24: 'ILA Licores y Destilados (31.5%)',
      25: 'ILA Vinos (20.5%)',
      26: 'ILA Cervezas (20.5%)',
      27: 'ILA Analcohólica (10%)',
      271: 'ILA Analcohólica Azúcar Alta (18%)'
    };

    for (const it of items) {
      const sub = montoLinea(it);
      if (it.exento) {
        exentoTotal += sub;
        continue;
      }
      afectoTotal += sub;

      const tasaIla = conIla ? tasaAdicional(it) : 0;
      if (tasaIla <= 0 && !detalleNeto) {
        afectoSinIla += sub;
        continue;
      }

      // Con impuesto adicional, o con detalle neto, el neto se separa por linea
      const neto = netoDeLinea(sub, tasaIla);
      netoPorLinea += neto;
      if (tasaIla <= 0) continue;

      const ila = Math.round(neto * (tasaIla / 100));
      const codigoIla = Number(it.codigoIla);
      ilaTotal += ila;
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

    const montoNeto = Math.round(afectoSinIla / 1.19) + netoPorLinea;

    return {
      montoNeto,
      tasaIva: 19.0,
      montoIva: afectoTotal - montoNeto - ilaTotal,
      montoExento: exentoTotal,
      montoIla: ilaTotal,
      desgloseIla: Object.values(desgloseMap),
      montoTotal: exentoTotal + afectoTotal
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

    const fecha = req.fechaEmision || fechaLocal();
    const isPaymentCard = req.metodoPago.toUpperCase() !== 'EFECTIVO';
    const isDevolucion = req.tipoDte === TipoDTE.NOTA_CREDITO;
    const isFactura = req.tipoDte === TipoDTE.FACTURA_ELECTRONICA || req.tipoDte === TipoDTE.FACTURA_EXENTA;
    const esBoleta = (tipo?: number) => tipo === TipoDTE.BOLETA_ELECTRONICA || tipo === TipoDTE.BOLETA_EXENTA;
    // La boleta y la nota de credito que la anula no llevan ILA; la factura a otro vendedor si (art. 43 letra d)
    const conIla = !esBoleta(req.tipoDte || TipoDTE.BOLETA_ELECTRONICA) && !(isDevolucion && esBoleta(req.referencia?.tipoDocRef));
    const tipoEmitido = req.tipoDte || TipoDTE.BOLETA_ELECTRONICA;
    // MntBruto es solo para documentos sin impuestos adicionales y no aplica a la guia (formato DTE
    // del SII, campo 10 de IdDoc). En esos casos el detalle va en neto.
    const llevaIla = conIla && req.items.some((it) => !it.exento && tasaAdicional(it) > 0);
    const detalleNeto = !esBoleta(tipoEmitido) && (tipoEmitido === TipoDTE.GUIA_DESPACHO || llevaIla);
    const totales = this.calculateTotals(req.items, conIla, detalleNeto);

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

    // Los RUT se normalizan antes de gastar el folio, armar el timbre y firmar: un RUT invalido no
    // consume folio, y el XML firmado nunca se reescribe despues
    const rutEmisor = rutSii(emisor.rut);
    const rutReceptor = rutSii(receptor.rut);
    const rutChofer = tipoDte === TipoDTE.GUIA_DESPACHO && req.transporte ? rutSii(req.transporte.choferRut || emisor.rut) : '';

    // 1. Asignar folio correlativo atómico con el CAF activo
    const { folio, caf } = defaultCafManager.consumeNextFolio(req.tenantId, tipoDte);

    // 2. Generar Timbre Electrónico DTE (TED) con la llave <RSASK> del CAF
    const tedResult = defaultCafManager.generateTed({
      emisorRut: rutEmisor,
      tipoDte,
      folio,
      fechaEmision: fecha,
      receptorRut: rutReceptor,
      receptorRazonSocial: receptor.razonSocial,
      montoTotal: totales.montoTotal,
      primerItem: primerItemNombre,
      cafXml: caf.caf_xml_content,
      rsaskPrivateKey: caf.rsask_private_key
    });

    // 3. Construir el documento XML oficial DTE
    const docId = `DTE_${tipoDte}_F${folio}`;
    const tmstFirma = marcaLocal();

    // Orden del esquema del SII: IndExe va antes del nombre y CodImpAdic justo antes del monto
    let itemsXml = '';
    req.items.forEach((it, idx) => {
      const tasaIla = conIla && !it.exento ? tasaAdicional(it) : 0;
      const exeTag = it.exento ? '<IndExe>1</IndExe>' : '';
      const ilaTag = tasaIla > 0 ? `<CodImpAdic>${Number(it.codigoIla)}</CodImpAdic>` : '';
      // con detalle neto, el precio y el monto de la linea van sin IVA ni impuesto adicional
      const neto = detalleNeto && !it.exento;
      const monto = neto ? netoDeLinea(montoLinea(it), tasaIla) : montoLinea(it);
      const precio = neto ? Number(it.precioUnitario) / (1.19 + tasaIla / 100) : Number(it.precioUnitario);
      // el esquema pide un precio mayor que cero: un item sin valor, como un traslado, va sin precio
      const prcTag = Number(decimalesSii(precio)) > 0 ? `<PrcItem>${decimalesSii(precio)}</PrcItem>` : '';
      itemsXml += `<Detalle><NroLinDet>${idx + 1}</NroLinDet>${exeTag}<NmbItem>${textoSii(it.nombre, 80)}</NmbItem><QtyItem>${decimalesSii(Number(it.cantidad))}</QtyItem>${prcTag}${ilaTag}<MontoItem>${monto}</MontoItem></Detalle>`;
    });

    // Encabezado según tipo de documento. IndServicio 3 en la boleta es venta y servicios; en la
    // factura significaria factura de servicios, y el almacen vende mercaderia
    let idDocExtra = esBoleta(tipoDte) ? '<IndServicio>3</IndServicio>' : '';
    if (tipoDte === TipoDTE.GUIA_DESPACHO) {
      idDocExtra = `<IndTraslado>${req.transporte?.indTraslado || 5}</IndTraslado>`;
    }
    // La boleta es bruta por definicion. En los demas tipos el detalle lleva los precios del catalogo,
    // que incluyen IVA, y el SII los leeria como netos si no se declara
    if (!esBoleta(tipoDte) && !detalleNeto) {
      idDocExtra += '<MntBruto>1</MntBruto>';
    }

    // Receptor: la boleta no admite giro; los demas documentos van con los datos del comercio. Los
    // largos son los del esquema del SII, que rechaza el documento si un texto se pasa
    let receptorXml = '';
    if (!esBoleta(tipoDte) && (isFactura || tipoDte === TipoDTE.GUIA_DESPACHO || receptor.giro)) {
      receptorXml = `<Receptor><RUTRecep>${rutReceptor}</RUTRecep><RznSocRecep>${textoSii(receptor.razonSocial, 100)}</RznSocRecep><GiroRecep>${textoSii(receptor.giro || 'COMERCIO', 40)}</GiroRecep><DirRecep>${textoSii(receptor.direccion || emisor.direccion, 70)}</DirRecep><CmnaRecep>${textoSii(receptor.comuna || emisor.comuna, 20)}</CmnaRecep><CiudadRecep>${textoSii(receptor.ciudad || emisor.ciudad, 20)}</CiudadRecep></Receptor>`;
    } else {
      receptorXml = `<Receptor><RUTRecep>${rutReceptor}</RUTRecep><RznSocRecep>${textoSii(receptor.razonSocial, 100)}</RznSocRecep></Receptor>`;
    }

    // El emisor de la boleta tiene sus propios nombres de nodo y no lleva actividad economica
    const emisorXml = esBoleta(tipoDte)
      ? `<Emisor><RUTEmisor>${rutEmisor}</RUTEmisor><RznSocEmisor>${textoSii(emisor.razonSocial, 100)}</RznSocEmisor><GiroEmisor>${textoSii(emisor.giro, 80)}</GiroEmisor><DirOrigen>${textoSii(emisor.direccion, 70)}</DirOrigen><CmnaOrigen>${textoSii(emisor.comuna, 20)}</CmnaOrigen><CiudadOrigen>${textoSii(emisor.ciudad, 20)}</CiudadOrigen></Emisor>`
      : `<Emisor><RUTEmisor>${rutEmisor}</RUTEmisor><RznSoc>${textoSii(emisor.razonSocial, 100)}</RznSoc><GiroEmis>${textoSii(emisor.giro, 80)}</GiroEmis><Acteco>${/^\d{6}$/.test(String(emisor.acteco)) ? emisor.acteco : '471100'}</Acteco><DirOrigen>${textoSii(emisor.direccion, 70)}</DirOrigen><CmnaOrigen>${textoSii(emisor.comuna, 20)}</CmnaOrigen><CiudadOrigen>${textoSii(emisor.ciudad, 20)}</CiudadOrigen></Emisor>`;

    // Totales con desglose de ILA si existe
    let ilaTotalesXml = '';
    if (totales.desgloseIla && totales.desgloseIla.length > 0) {
      for (const ila of totales.desgloseIla) {
        ilaTotalesXml += `<ImptoReten><TipoImp>${ila.codigo}</TipoImp><TasaImp>${ila.tasa}</TasaImp><MontoImp>${ila.monto}</MontoImp></ImptoReten>`;
      }
    }

    // Una boleta exenta no tiene parte afecta; lo exento se declara aparte para que el documento cuadre
    const totalesAfectosXml =
      (totales.montoNeto > 0 || totales.montoExento === 0
        ? `<MntNeto>${totales.montoNeto}</MntNeto>`
        : '') +
      (totales.montoExento > 0 ? `<MntExe>${totales.montoExento}</MntExe>` : '') +
      (totales.montoNeto > 0 || totales.montoExento === 0
        ? `${esBoleta(tipoDte) ? '' : '<TasaIVA>19</TasaIVA>'}<IVA>${totales.montoIva}</IVA>`
        : '');

    // Nodo Referencia para Notas de Crédito (Tipo 61) o documentos con referencia
    let referenciaXml = '';
    if (req.referencia) {
      referenciaXml = `<Referencia><NroLinRef>${req.referencia.nroLineaRef || 1}</NroLinRef><TpoDocRef>${req.referencia.tipoDocRef}</TpoDocRef><FolioRef>${req.referencia.folioRef}</FolioRef><FchRef>${req.referencia.fechaRef}</FchRef><CodRef>${req.referencia.codigoRef || 1}</CodRef><RazonRef>${textoSii(req.referencia.razonRef, 90)}</RazonRef></Referencia>`;
    }

    // Nodo Transporte para Guía de Despacho (Tipo 52)
    let transporteXml = '';
    if (tipoDte === TipoDTE.GUIA_DESPACHO && req.transporte) {
      transporteXml = `<Transporte><Patente>${textoSii(req.transporte.patente || 'ABCD12', 8)}</Patente><RUTTrans>${rutChofer}</RUTTrans><Chofer><RUTChofer>${rutChofer}</RUTChofer><NombreChofer>${textoSii(req.transporte.choferNombre || 'Chofer Asignado', 30)}</NombreChofer></Chofer><DirDest>${textoSii(req.transporte.direccionDestino || receptor.direccion || 'Local Destino', 70)}</DirDest><CmnaDest>${textoSii(req.transporte.comunaDestino || receptor.comuna || emisor.comuna, 20)}</CmnaDest></Transporte>`;
    }

    const documentoXml = `<Documento ID="${docId}"><Encabezado><IdDoc><TipoDTE>${tipoDte}</TipoDTE><Folio>${folio}</Folio><FchEmis>${fecha}</FchEmis>${idDocExtra}</IdDoc>${emisorXml}${receptorXml}${transporteXml}<Totales>${totalesAfectosXml}${ilaTotalesXml}<MntTotal>${totales.montoTotal}</MntTotal></Totales></Encabezado>${itemsXml}${referenciaXml}${tedResult.tedXml}<TmstFirma>${tmstFirma}</TmstFirma></Documento>`;

    // 4. Firmar el XML con XMLDSig
    const signatureXml = defaultXmlSigner.signDocument(documentoXml, docId, undefined, 'http://www.sii.cl/SiiDte');
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

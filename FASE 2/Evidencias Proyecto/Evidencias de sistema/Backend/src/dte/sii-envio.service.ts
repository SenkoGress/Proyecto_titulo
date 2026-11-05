import { v4 as uuidv4 } from 'uuid';
import { defaultSqliteClient, SqliteClient } from '../database/sqlite/client';
import { defaultDteEmitter, DteEmitterService } from './dte-emitter.service';
import { defaultXmlSigner, XmlSignerService } from './xml-signer.service';
import { SiiTransport } from './types';
import { SiiTransportHttp } from './sii-transport.http';
import { logger } from '../utils/logger';

export interface RequisitoFaltante {
  requisito: string;
  detalle: string;
}

export interface DocumentoPendiente {
  id: string;
  tipo_dte: number;
  folio: number;
  fecha_emision: string;
  monto_total: number;
  /** El folio proviene de un CAF que el SII nunca autorizo, de modo que no es enviable. */
  folio_provisional: boolean;
}

export type TipoSobre = 'EnvioDTE' | 'EnvioBOLETA';

export interface SobrePreparado {
  envioId: string;
  tipoSobre: TipoSobre;
  sobreXml: string;
  documentos: number;
}

export interface EnvioDeSobre {
  envio_id: string;
  tipo_sobre: TipoSobre;
  documentos: number;
  enviado: boolean;
  track_id?: string;
  motivo?: string;
}

export interface ResultadoEnvio {
  enviado: boolean;
  mensaje: string;
  /** Identificador del primer sobre, para la descarga inmediata desde la pantalla. */
  envio_id?: string;
  track_id?: string;
  documentos: number;
  sobres: EnvioDeSobre[];
  faltantes: RequisitoFaltante[];
}

/**
 * Las boletas electronicas (39 y 41) viajan en un sobre EnvioBOLETA y el resto de los documentos
 * en uno EnvioDTE: son dos formatos distintos y el servicio rechaza el sobre que los mezcla.
 */
export function tipoDeSobre(tipoDte: number): TipoSobre {
  return tipoDte === 39 || tipoDte === 41 ? 'EnvioBOLETA' : 'EnvioDTE';
}

export { SiiTransport } from './types';

export class TransporteNoConfigurado implements SiiTransport {
  public disponible(): boolean {
    return false;
  }

  public async subirSobre(): Promise<{ trackId: string }> {
    throw new Error('No hay transporte hacia el SII configurado');
  }
}

export class SiiEnvioService {
  constructor(
    private readonly sqliteClient: SqliteClient = defaultSqliteClient,
    private readonly emitter: DteEmitterService = defaultDteEmitter,
    private readonly signer: XmlSignerService = defaultXmlSigner,
    private readonly transport: SiiTransport = new TransporteNoConfigurado()
  ) {}

  /** Ambiente declarado por el local: certificacion (Maullin) o produccion (Palena). */
  public getAmbiente(tenantId: string): string {
    const fila = this.sqliteClient.queryOne<{ valor: string }>(
      "SELECT valor FROM configuracion_sistema WHERE tenant_id = ? AND clave = 'sii_ambiente'",
      [tenantId]
    );
    return fila?.valor || 'CERTIFICACION_MAULLIN';
  }

  /**
   * Lo que falta para poder enviar. Se responde como lista y no como un si o un no, porque el
   * local necesita saber que gestion tiene pendiente: el certificado se compra, los folios se
   * piden al SII, y ninguna de las dos cosas depende del sistema.
   */
  public revisarRequisitos(tenantId: string): RequisitoFaltante[] {
    const faltantes: RequisitoFaltante[] = [];

    const certificado = this.sqliteClient.queryOne<{ total: number }>(
      `SELECT COUNT(*) as total FROM configuracion_sistema
        WHERE tenant_id = ? AND clave IN ('sii_certificado_pem', 'sii_llave_privada_pem')
          AND valor IS NOT NULL AND valor <> ''`,
      [tenantId]
    );
    if (!certificado || Number(certificado.total) < 2) {
      faltantes.push({
        requisito: 'Certificado digital del emisor',
        detalle:
          'Falta cargar el certificado X.509 emitido por un proveedor autorizado por el SII, como ' +
          'certificado y llave en formato PEM. Sin el no se puede firmar la semilla ni obtener el ' +
          'token de la sesion, que es el primer paso de cualquier envio.'
      });
    }

    const cafAutorizado = this.sqliteClient.queryOne<{ total: number }>(
      "SELECT COUNT(*) as total FROM sii_caf WHERE tenant_id = ? AND origen = 'SII'",
      [tenantId]
    );
    if (!cafAutorizado || Number(cafAutorizado.total) === 0) {
      faltantes.push({
        requisito: 'Folios CAF autorizados',
        detalle:
          'Los folios en uso se provisionaron en el equipo para poder operar. El SII no los ' +
          'autorizo, de modo que los documentos emitidos con ellos no son enviables: hay que ' +
          'cargar el archivo CAF que entrega el portal del SII.'
      });
    }

    if (!this.transport.disponible()) {
      faltantes.push({
        requisito: 'Transporte hacia el SII',
        detalle:
          'El envio automatico necesita el certificado para autenticarse ante el servicio. ' +
          'Mientras tanto el sobre queda preparado y firmado, y puede subirse a mano en el ' +
          'portal del SII.'
      });
    }

    return faltantes;
  }

  /** Documentos emitidos que todavia no viajaron en ningun sobre. */
  public documentosPendientes(tenantId: string): DocumentoPendiente[] {
    const filas = this.sqliteClient.query<any>(
      `SELECT id, tipo_dte, folio, fecha_emision, monto_total
         FROM sii_dte_emitidos
        WHERE tenant_id = ? AND envio_id IS NULL AND estado_sii = 'EMITIDO_LOCAL'
        ORDER BY fecha_emision ASC`,
      [tenantId]
    );

    return filas.map((fila) => ({
      id: fila.id,
      tipo_dte: Number(fila.tipo_dte),
      folio: Number(fila.folio),
      fecha_emision: fila.fecha_emision,
      monto_total: Number(fila.monto_total),
      folio_provisional: this.folioEsProvisional(tenantId, Number(fila.tipo_dte), Number(fila.folio))
    }));
  }

  /** El folio cae en el rango de un CAF autorizado, o en uno provisionado por el equipo. */
  private folioEsProvisional(tenantId: string, tipoDte: number, folio: number): boolean {
    const caf = this.sqliteClient.queryOne<{ origen: string }>(
      `SELECT origen FROM sii_caf
        WHERE tenant_id = ? AND tipo_dte = ? AND folio_desde <= ? AND folio_hasta >= ?
        ORDER BY created_at DESC LIMIT 1`,
      [tenantId, tipoDte, folio, folio]
    );
    return (caf?.origen || 'PROVISIONAL') !== 'SII';
  }

  /**
   * Arma el sobre EnvioDTE con los documentos indicados, lo firma y lo deja registrado.
   *
   * El sobre se prepara aunque el envio automatico no sea posible: es el archivo que el SII
   * recibe, de modo que sirve para subirlo a mano en el portal mientras el certificado no este.
   */
  public prepararSobres(tenantId: string, dteIds?: string[]): SobrePreparado[] {
    const pendientes = this.documentosPendientes(tenantId);
    const elegidos = dteIds?.length ? pendientes.filter((d) => dteIds.includes(d.id)) : pendientes;

    if (elegidos.length === 0) {
      throw new Error('No hay documentos emitidos pendientes de envio');
    }

    const porSobre = new Map<TipoSobre, DocumentoPendiente[]>();
    for (const documento of elegidos) {
      const tipo = tipoDeSobre(documento.tipo_dte);
      porSobre.set(tipo, [...(porSobre.get(tipo) || []), documento]);
    }

    return [...porSobre.entries()].map(([tipoSobre, documentos]) =>
      this.armarSobre(tenantId, tipoSobre, documentos)
    );
  }

  private armarSobre(
    tenantId: string,
    tipoSobre: TipoSobre,
    documentos: DocumentoPendiente[]
  ): SobrePreparado {
    const { emisor } = this.emitter.getTenantFiscalConfig(tenantId);
    const ambiente = this.getAmbiente(tenantId);

    const cuerpos = documentos
      .map((d) => {
        const fila = this.sqliteClient.queryOne<{ dte_xml_completo: string }>(
          'SELECT dte_xml_completo FROM sii_dte_emitidos WHERE id = ?',
          [d.id]
        );
        return fila?.dte_xml_completo || '';
      })
      .join('');

    // Un subtotal por tipo de documento: la caratula declara cuantos lleva de cada uno, y el
    // servicio contrasta esa cuenta con el contenido.
    const porTipo = new Map<number, number>();
    for (const documento of documentos) {
      porTipo.set(documento.tipo_dte, (porTipo.get(documento.tipo_dte) || 0) + 1);
    }
    const subtotales = [...porTipo.entries()]
      .map(([tipo, cantidad]) => `<SubTotDTE><TpoDTE>${tipo}</TpoDTE><NroDTE>${cantidad}</NroDTE></SubTotDTE>`)
      .join('');

    const setId = `SetDoc_${Date.now()}_${tipoSobre}`;
    const caratula =
      `<Caratula version="1.0">` +
      `<RutEmisor>${emisor.rut}</RutEmisor>` +
      `<RutEnvia>${emisor.rut}</RutEnvia>` +
      `<RutReceptor>60803000-K</RutReceptor>` +
      `<FchResol>${new Date().toISOString().substring(0, 10)}</FchResol>` +
      `<NroResol>0</NroResol>` +
      `<TmstFirmaEnv>${new Date().toISOString().substring(0, 19)}</TmstFirmaEnv>` +
      subtotales +
      `</Caratula>`;

    const setDte = `<SetDTE ID="${setId}">${caratula}${cuerpos}</SetDTE>`;
    const firma = this.signer.signDocument(setDte, setId);
    const sobreXml =
      `<?xml version="1.0" encoding="ISO-8859-1"?>` +
      `<${tipoSobre} version="1.0" xmlns="http://www.sii.cl/SiiDte">${setDte}${firma}</${tipoSobre}>`;

    const envioId = uuidv4();
    this.sqliteClient.execute(
      `INSERT INTO sii_envios (id, tenant_id, ambiente, documentos, estado, sobre_xml, tipo_sobre)
       VALUES (?, ?, ?, ?, 'PREPARADO', ?, ?)`,
      [envioId, tenantId, ambiente, documentos.length, sobreXml, tipoSobre]
    );

    for (const documento of documentos) {
      this.sqliteClient.execute('UPDATE sii_dte_emitidos SET envio_id = ? WHERE id = ?', [
        envioId,
        documento.id
      ]);
    }

    return { envioId, tipoSobre, sobreXml, documentos: documentos.length };
  }

  /**
   * Prepara el sobre y lo sube al SII cuando hay con que. Si falta algo, el sobre igual queda
   * preparado y se devuelve lo que falta: el documento no se marca como enviado, porque no lo
   * esta.
   */
  public async enviar(tenantId: string, dteIds?: string[]): Promise<ResultadoEnvio> {
    const faltantes = this.revisarRequisitos(tenantId);
    const sobres = this.prepararSobres(tenantId, dteIds);
    const documentos = sobres.reduce((suma, s) => suma + s.documentos, 0);
    const nombres = sobres.map((s) => `${s.tipoSobre} (${s.documentos})`).join(' y ');

    if (faltantes.length > 0) {
      return {
        enviado: false,
        mensaje:
          (sobres.length === 1
            ? `El sobre ${nombres} quedo preparado y firmado, pero no se envio: `
            : `Los sobres ${nombres} quedaron preparados y firmados, pero no se enviaron: `) +
          faltantes.map((f) => f.requisito.toLowerCase()).join(', ') + '.',
        envio_id: sobres[0].envioId,
        documentos,
        sobres: sobres.map((s) => ({
          envio_id: s.envioId,
          tipo_sobre: s.tipoSobre,
          documentos: s.documentos,
          enviado: false
        })),
        faltantes
      };
    }

    const { emisor } = this.emitter.getTenantFiscalConfig(tenantId);
    const ambiente = this.getAmbiente(tenantId);
    const resultados: EnvioDeSobre[] = [];

    for (const sobre of sobres) {
      try {
        const { trackId } = await this.transport.subirSobre(sobre.sobreXml, ambiente, emisor.rut);

        this.sqliteClient.execute(
          "UPDATE sii_envios SET estado = 'ENVIADO', track_id = ? WHERE id = ?",
          [trackId, sobre.envioId]
        );
        this.sqliteClient.execute(
          "UPDATE sii_dte_emitidos SET estado_sii = 'ENVIADO_SII', track_id_sii = ? WHERE envio_id = ?",
          [trackId, sobre.envioId]
        );

        resultados.push({
          envio_id: sobre.envioId,
          tipo_sobre: sobre.tipoSobre,
          documentos: sobre.documentos,
          enviado: true,
          track_id: trackId
        });
      } catch (err) {
        const detalle = err instanceof Error ? err.message : String(err);

        // El sobre queda registrado como rechazado y sus documentos vuelven a quedar pendientes:
        // su estado no puede decir enviado cuando el SII no lo recibio. Un sobre que falla no
        // cancela los otros, por la misma razon que un fallo de la sincronizacion no cancela sus
        // demas pasos.
        this.sqliteClient.execute(
          "UPDATE sii_envios SET estado = 'RECHAZADO', motivo = ? WHERE id = ?",
          [detalle, sobre.envioId]
        );
        this.sqliteClient.execute('UPDATE sii_dte_emitidos SET envio_id = NULL WHERE envio_id = ?', [
          sobre.envioId
        ]);

        logger.warn('SiiEnvioService', 'El sobre no fue aceptado por el SII', {
          envioId: sobre.envioId,
          tipoSobre: sobre.tipoSobre,
          error: detalle
        });

        resultados.push({
          envio_id: sobre.envioId,
          tipo_sobre: sobre.tipoSobre,
          documentos: sobre.documentos,
          enviado: false,
          motivo: detalle
        });
      }
    }

    const aceptados = resultados.filter((r) => r.enviado);
    const rechazados = resultados.filter((r) => !r.enviado);

    return {
      enviado: rechazados.length === 0,
      mensaje:
        rechazados.length === 0
          ? `El SII recibio ${aceptados.length === 1 ? 'el sobre' : `${aceptados.length} sobres`} ` +
            `con ${documentos} documento${documentos === 1 ? '' : 's'}: ` +
            aceptados.map((r) => `${r.tipo_sobre} ${r.track_id}`).join(', ') + '.'
          : aceptados.length === 0
            ? `El SII no recibio ${sobres.length === 1 ? 'el sobre' : 'ningun sobre'}: ${rechazados[0].motivo}`
            : `El SII recibio ${aceptados.length} de ${sobres.length} sobres. ` +
              `El resto sigue pendiente: ${rechazados[0].motivo}`,
      envio_id: sobres[0].envioId,
      track_id: aceptados[0]?.track_id,
      documentos,
      sobres: resultados,
      faltantes: []
    };
  }

  /** Sobre guardado, para descargarlo y subirlo a mano en el portal del SII. */
  public getSobre(
    tenantId: string,
    envioId: string
  ): { sobre_xml: string; estado: string; tipo_sobre: string } | null {
    const fila = this.sqliteClient.queryOne<{ sobre_xml: string; estado: string; tipo_sobre: string }>(
      'SELECT sobre_xml, estado, tipo_sobre FROM sii_envios WHERE id = ? AND tenant_id = ?',
      [envioId, tenantId]
    );
    return fila || null;
  }

  public listarEnvios(tenantId: string): any[] {
    return this.sqliteClient.query<any>(
      `SELECT id, ambiente, tipo_sobre, documentos, estado, track_id, motivo, creado_at
         FROM sii_envios WHERE tenant_id = ? ORDER BY creado_at DESC LIMIT 50`,
      [tenantId]
    );
  }
}

export const defaultSiiEnvio = new SiiEnvioService(
  undefined,
  undefined,
  undefined,
  new SiiTransportHttp()
);

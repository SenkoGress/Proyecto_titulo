import { v4 as uuidv4 } from 'uuid';
import { defaultSqliteClient, SqliteClient } from '../database/sqlite/client';
import { defaultDteEmitter, DteEmitterService } from './dte-emitter.service';
import { defaultXmlSigner, XmlSignerService } from './xml-signer.service';
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

export interface ResultadoEnvio {
  enviado: boolean;
  mensaje: string;
  envio_id?: string;
  track_id?: string;
  documentos: number;
  faltantes: RequisitoFaltante[];
}

/**
 * Transporte hacia el SII. La implementacion real exige el certificado digital del emisor, que se
 * compra a un proveedor autorizado: con el se firma la semilla, se obtiene el token y se sube el
 * sobre. Mientras no exista, el sistema no dispone de transporte y lo declara en vez de simular un
 * envio, por la misma razon que el aviso de reposicion no informa correos que no salieron.
 */
export interface SiiTransport {
  disponible(): boolean;
  subirSobre(sobreXml: string, ambiente: string, rutEmisor: string): Promise<{ trackId: string }>;
}

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

    const certificado = this.sqliteClient.queryOne<{ valor: string }>(
      "SELECT valor FROM configuracion_sistema WHERE tenant_id = ? AND clave = 'sii_certificado_p12'",
      [tenantId]
    );
    if (!certificado?.valor) {
      faltantes.push({
        requisito: 'Certificado digital del emisor',
        detalle:
          'Falta cargar el certificado X.509 (.p12 o .pfx) emitido por un proveedor autorizado por ' +
          'el SII. Sin el no se puede firmar la semilla ni obtener el token de la sesion.'
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
  public prepararSobre(tenantId: string, dteIds?: string[]): {
    envioId: string;
    sobreXml: string;
    documentos: number;
  } {
    const pendientes = this.documentosPendientes(tenantId);
    const elegidos = dteIds?.length ? pendientes.filter((d) => dteIds.includes(d.id)) : pendientes;

    if (elegidos.length === 0) {
      throw new Error('No hay documentos emitidos pendientes de envio');
    }

    const { emisor } = this.emitter.getTenantFiscalConfig(tenantId);
    const ambiente = this.getAmbiente(tenantId);

    const documentos = elegidos
      .map((d) => {
        const fila = this.sqliteClient.queryOne<{ dte_xml_completo: string }>(
          'SELECT dte_xml_completo FROM sii_dte_emitidos WHERE id = ?',
          [d.id]
        );
        return fila?.dte_xml_completo || '';
      })
      .join('');

    const setId = `SetDoc_${Date.now()}`;
    const caratula =
      `<Caratula version="1.0">` +
      `<RutEmisor>${emisor.rut}</RutEmisor>` +
      `<RutEnvia>${emisor.rut}</RutEnvia>` +
      `<RutReceptor>60803000-K</RutReceptor>` +
      `<FchResol>${new Date().toISOString().substring(0, 10)}</FchResol>` +
      `<NroResol>0</NroResol>` +
      `<TmstFirmaEnv>${new Date().toISOString().substring(0, 19)}</TmstFirmaEnv>` +
      `<SubTotDTE><TpoDTE>${elegidos[0].tipo_dte}</TpoDTE><NroDTE>${elegidos.length}</NroDTE></SubTotDTE>` +
      `</Caratula>`;

    const setDte = `<SetDTE ID="${setId}">${caratula}${documentos}</SetDTE>`;
    const firma = this.signer.signDocument(setDte, setId);
    const sobreXml =
      `<?xml version="1.0" encoding="ISO-8859-1"?>` +
      `<EnvioDTE version="1.0" xmlns="http://www.sii.cl/SiiDte">${setDte}${firma}</EnvioDTE>`;

    const envioId = uuidv4();
    this.sqliteClient.execute(
      `INSERT INTO sii_envios (id, tenant_id, ambiente, documentos, estado, sobre_xml)
       VALUES (?, ?, ?, ?, 'PREPARADO', ?)`,
      [envioId, tenantId, ambiente, elegidos.length, sobreXml]
    );

    for (const documento of elegidos) {
      this.sqliteClient.execute('UPDATE sii_dte_emitidos SET envio_id = ? WHERE id = ?', [
        envioId,
        documento.id
      ]);
    }

    return { envioId, sobreXml, documentos: elegidos.length };
  }

  /**
   * Prepara el sobre y lo sube al SII cuando hay con que. Si falta algo, el sobre igual queda
   * preparado y se devuelve lo que falta: el documento no se marca como enviado, porque no lo
   * esta.
   */
  public async enviar(tenantId: string, dteIds?: string[]): Promise<ResultadoEnvio> {
    const faltantes = this.revisarRequisitos(tenantId);
    const sobre = this.prepararSobre(tenantId, dteIds);

    if (faltantes.length > 0) {
      return {
        enviado: false,
        mensaje:
          `El sobre con ${sobre.documentos} documento${sobre.documentos === 1 ? '' : 's'} quedo ` +
          'preparado y firmado, pero no se envio: ' +
          faltantes.map((f) => f.requisito.toLowerCase()).join(', ') + '.',
        envio_id: sobre.envioId,
        documentos: sobre.documentos,
        faltantes
      };
    }

    const { emisor } = this.emitter.getTenantFiscalConfig(tenantId);
    const ambiente = this.getAmbiente(tenantId);

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

      return {
        enviado: true,
        mensaje: `Sobre recibido por el SII con el identificador ${trackId}.`,
        envio_id: sobre.envioId,
        track_id: trackId,
        documentos: sobre.documentos,
        faltantes: []
      };
    } catch (err) {
      const detalle = err instanceof Error ? err.message : String(err);

      // El sobre queda registrado como rechazado y los documentos vuelven a quedar pendientes:
      // su estado no puede decir enviado cuando el SII no lo recibio.
      this.sqliteClient.execute(
        "UPDATE sii_envios SET estado = 'RECHAZADO', motivo = ? WHERE id = ?",
        [detalle, sobre.envioId]
      );
      this.sqliteClient.execute('UPDATE sii_dte_emitidos SET envio_id = NULL WHERE envio_id = ?', [
        sobre.envioId
      ]);

      logger.warn('SiiEnvioService', 'El sobre no fue aceptado por el SII', {
        envioId: sobre.envioId,
        error: detalle
      });

      return {
        enviado: false,
        mensaje: `El SII no recibio el sobre: ${detalle}`,
        envio_id: sobre.envioId,
        documentos: sobre.documentos,
        faltantes: []
      };
    }
  }

  /** Sobre guardado, para descargarlo y subirlo a mano en el portal del SII. */
  public getSobre(tenantId: string, envioId: string): { sobre_xml: string; estado: string } | null {
    const fila = this.sqliteClient.queryOne<{ sobre_xml: string; estado: string }>(
      'SELECT sobre_xml, estado FROM sii_envios WHERE id = ? AND tenant_id = ?',
      [envioId, tenantId]
    );
    return fila || null;
  }

  public listarEnvios(tenantId: string): any[] {
    return this.sqliteClient.query<any>(
      `SELECT id, ambiente, documentos, estado, track_id, motivo, creado_at
         FROM sii_envios WHERE tenant_id = ? ORDER BY creado_at DESC LIMIT 50`,
      [tenantId]
    );
  }
}

export const defaultSiiEnvio = new SiiEnvioService();

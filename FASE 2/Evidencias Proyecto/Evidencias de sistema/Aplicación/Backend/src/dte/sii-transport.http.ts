import { defaultSqliteClient, SqliteClient } from '../database/sqlite/client';
import { defaultXmlSigner, XmlSignerService } from './xml-signer.service';
import { SiiTransport } from './types';
import { logger } from '../utils/logger';

interface Credenciales {
  certificadoPem: string;
  llavePrivadaPem: string;
}

/** Los dos ambientes del servicio: certificacion y produccion. */
const SERVIDORES: Record<string, string> = {
  CERTIFICACION_MAULLIN: 'https://maullin.sii.cl',
  PRODUCCION_PALENA: 'https://palena.sii.cl'
};

/**
 * Dialogo real con el SII: semilla, token y subida del sobre.
 *
 * El servicio no acepta una peticion suelta. Primero entrega una semilla, que el emisor firma con
 * su certificado para demostrar quien es; a cambio recibe un token con vigencia corta, y recien
 * con ese token puede subir el sobre. Cada paso depende del anterior, de modo que sin certificado
 * no hay forma de empezar: por eso `disponible()` responde que no en lugar de intentar.
 *
 * El certificado se guarda en la configuracion del local en formato PEM, que es lo que la libreria
 * criptografica de la plataforma sabe leer. Desde el archivo .p12 que entrega la certificadora se
 * obtiene asi:
 *
 *   openssl pkcs12 -in certificado.p12 -clcerts -nokeys -out certificado.pem
 *   openssl pkcs12 -in certificado.p12 -nocerts -nodes -out llave.pem
 *
 * ADVERTENCIA HONESTA: el recorrido completo contra el servicio del SII no esta verificado,
 * porque exige un certificado emitido por una certificadora autorizada y folios CAF reales, y el
 * proyecto no cuenta con ninguno de los dos. Lo que si esta probado es que sin credenciales no se
 * intenta nada, que el ambiente elige el servidor correcto y que cada fallo se informa como fallo.
 */
export class SiiTransportHttp implements SiiTransport {
  constructor(
    private readonly sqliteClient: SqliteClient = defaultSqliteClient,
    private readonly signer: XmlSignerService = defaultXmlSigner,
    private readonly tenantId: string = '00000000-0000-0000-0000-000000000001'
  ) {}

  public disponible(): boolean {
    return this.credenciales() !== null;
  }

  private valorConfig(clave: string): string | null {
    try {
      const fila = this.sqliteClient.queryOne<{ valor: string }>(
        'SELECT valor FROM configuracion_sistema WHERE tenant_id = ? AND clave = ?',
        [this.tenantId, clave]
      );
      return fila?.valor || null;
    } catch {
      return null;
    }
  }

  private credenciales(): Credenciales | null {
    const certificadoPem = this.valorConfig('sii_certificado_pem');
    const llavePrivadaPem = this.valorConfig('sii_llave_privada_pem');

    if (!certificadoPem || !llavePrivadaPem) return null;
    return { certificadoPem, llavePrivadaPem };
  }

  private servidor(ambiente: string): string {
    return SERVIDORES[ambiente] || SERVIDORES.CERTIFICACION_MAULLIN;
  }

  /** Extrae el contenido de un nodo XML sin depender de un analizador completo. */
  private nodo(xml: string, etiqueta: string): string | null {
    const encontrado = xml.match(new RegExp(`<${etiqueta}[^>]*>([\\s\\S]*?)</${etiqueta}>`, 'i'));
    return encontrado ? encontrado[1].trim() : null;
  }

  private async obtenerSemilla(ambiente: string): Promise<string> {
    const respuesta = await fetch(`${this.servidor(ambiente)}/DTEWS/CrSeed.jws?WSDL`);
    if (!respuesta.ok) {
      throw new Error(`El servicio no entrego la semilla (HTTP ${respuesta.status})`);
    }

    const cuerpo = await respuesta.text();
    const semilla = this.nodo(cuerpo, 'SEMILLA');
    if (!semilla) {
      throw new Error('La respuesta del servicio no contiene la semilla');
    }
    return semilla;
  }

  private async obtenerToken(semilla: string, ambiente: string, credenciales: Credenciales): Promise<string> {
    const cuerpoSemilla = `<getToken><item><Semilla>${semilla}</Semilla></item></getToken>`;
    const firma = this.signer.signDocument(cuerpoSemilla, '', {
      privateKeyPem: credenciales.llavePrivadaPem,
      certificatePem: credenciales.certificadoPem
        .replace(/-----BEGIN CERTIFICATE-----/g, '')
        .replace(/-----END CERTIFICATE-----/g, '')
        .replace(/\s+/g, ''),
      modulusBase64: '',
      exponentBase64: 'AQAB'
    });

    const peticion = `<?xml version="1.0" encoding="UTF-8"?>${cuerpoSemilla.replace(
      '</getToken>',
      `${firma}</getToken>`
    )}`;

    const respuesta = await fetch(`${this.servidor(ambiente)}/DTEWS/GetTokenFromSeed.jws?WSDL`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/xml' },
      body: peticion
    });

    if (!respuesta.ok) {
      throw new Error(`El servicio no entrego el token (HTTP ${respuesta.status})`);
    }

    const cuerpo = await respuesta.text();
    const token = this.nodo(cuerpo, 'TOKEN');
    if (!token) {
      throw new Error('El servicio rechazo la semilla firmada y no entrego token');
    }
    return token;
  }

  public async subirSobre(
    sobreXml: string,
    ambiente: string,
    rutEmisor: string
  ): Promise<{ trackId: string }> {
    const credenciales = this.credenciales();
    if (!credenciales) {
      throw new Error('No hay certificado digital cargado para autenticarse ante el SII');
    }

    const semilla = await this.obtenerSemilla(ambiente);
    const token = await this.obtenerToken(semilla, ambiente, credenciales);

    const [rutSinDv, dv] = rutEmisor.replace(/\./g, '').split('-');
    const formulario = new FormData();
    formulario.append('rutSender', rutSinDv);
    formulario.append('dvSender', dv || '');
    formulario.append('rutCompany', rutSinDv);
    formulario.append('dvCompany', dv || '');
    formulario.append('archivo', new Blob([sobreXml], { type: 'text/xml' }), 'EnvioDTE.xml');

    const respuesta = await fetch(`${this.servidor(ambiente)}/cgi_dte/UPL/DTEUpload`, {
      method: 'POST',
      headers: { Cookie: `TOKEN=${token}`, 'User-Agent': 'GesTock' },
      body: formulario
    });

    if (!respuesta.ok) {
      throw new Error(`El servicio rechazo la subida (HTTP ${respuesta.status})`);
    }

    const cuerpo = await respuesta.text();
    const trackId = this.nodo(cuerpo, 'TRACKID');
    const estado = this.nodo(cuerpo, 'STATUS');

    if (!trackId) {
      throw new Error(`El servicio no devolvio identificador de seguimiento (estado ${estado || 'desconocido'})`);
    }

    logger.info('SiiTransportHttp', 'Sobre recibido por el SII', { trackId, ambiente });
    return { trackId };
  }
}

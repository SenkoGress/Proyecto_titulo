// ============================================================================
// GesTock XMLDSig Digital Signer Service (Firma Electrónica Avanzada DTE - SII)
// Estándar W3C XML Signature & Formato SII Res. Ex. N° 74 / Ley N° 20.727
// ============================================================================

import * as crypto from 'crypto';
import { logger } from '../utils/logger';

export interface SignerCertificate {
  privateKeyPem: string;
  certificatePem?: string;
  modulusBase64: string;
  exponentBase64: string;
}

export class XmlSignerService {
  private defaultKeyPair: SignerCertificate | null = null;

  constructor() {
    this.ensureDefaultCertificate();
  }

  private ensureDefaultCertificate(): void {
    if (!this.defaultKeyPair) {
      try {
        const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
          modulusLength: 2048,
          publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
          privateKeyEncoding: { type: 'pkcs1', format: 'pem' }
        });

        // Extraer componentes públicos para RSAKeyValue
        const pubKeyObj = crypto.createPublicKey(publicKey);
        const jwk = pubKeyObj.export({ format: 'jwk' });

        this.defaultKeyPair = {
          privateKeyPem: privateKey,
          modulusBase64: Buffer.from(jwk.n || '', 'base64url').toString('base64'),
          exponentBase64: Buffer.from(jwk.e || 'AQAB', 'base64url').toString('base64'),
          certificatePem: Buffer.from(publicKey).toString('base64')
        };
      } catch (err) {
        logger.error('XmlSigner', 'Error generating default certificate', err);
      }
    }
  }

  /**
   * Forma canonica C14N inclusiva (sin comentarios) de un fragmento que el sistema genero: los
   * elementos vacios se escriben con su etiqueta de cierre, los atributos van ordenados y despues de
   * la declaracion del espacio de nombres, y esa declaracion aparece en el primer elemento aunque
   * venga heredada (nsContexto) y en ningun otro que la repita. Asi lo calcula cualquier verificador
   * XMLDSig, y sin esto el SII no reconoce el digest ni la firma.
   *
   * ponytail: cubre el XML que arma GesTock (espacios de nombres por defecto, sin prefijos,
   * comentarios ni instrucciones de proceso). Para XML ajeno haria falta un C14N completo.
   */
  public canonicalize(xml: string, nsContexto = ''): string {
    const plano = xml
      .replace(/>\s+</g, '><')
      .replace(/\r\n?/g, '\n')
      .trim()
      .replace(/<([A-Za-z_][\w.:-]*)([^<>]*?)\s*\/>/g, '<$1$2></$1>');

    const pila: string[] = [nsContexto];
    let esPrimero = true;
    return plano.replace(/<(\/?)([A-Za-z_][\w.:-]*)([^<>]*)>/g, (_etiqueta, cierre: string, nombre: string, resto: string) => {
      if (cierre) {
        pila.pop();
        return `</${nombre}>`;
      }
      const heredado = pila[pila.length - 1];
      const declarado = /\sxmlns="([^"]*)"/.exec(resto);
      const propio = declarado ? declarado[1] : heredado;
      const atributos = [...resto.replace(/\sxmlns="[^"]*"/, '').matchAll(/\s([^\s=]+)="([^"]*)"/g)]
        .map((m) => [m[1], m[2]])
        .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
      const declarar = esPrimero ? propio !== '' : propio !== heredado;
      esPrimero = false;
      pila.push(propio);
      return `<${nombre}${declarar ? ` xmlns="${propio}"` : ''}${atributos.map(([n, v]) => ` ${n}="${v}"`).join('')}>`;
    });
  }

  /**
   * Digest SHA-1 en Base64 de un bloque XML, sobre su forma canonica en el contexto donde va
   */
  public calculateDigest(xmlContent: string, nsContexto = ''): string {
    const canonical = this.canonicalize(xmlContent, nsContexto);
    return crypto.createHash('sha1').update(canonical, 'utf8').digest('base64');
  }

  /**
   * Firma un documento DTE o RCOF incorporando el bloque XMLDSig <Signature>
   */
  public signDocument(
    xmlToSign: string,
    referenceUriId: string,
    customCert?: SignerCertificate,
    nsContexto = ''
  ): string {
    const cert = customCert || this.defaultKeyPair;
    if (!cert) {
      throw new Error('No hay certificado digital disponible para firmar el documento');
    }

    // 1. Calcular Digest del documento a referenciar
    const digestValue = this.calculateDigest(xmlToSign, nsContexto);

    // 2. Construir el bloque <SignedInfo>
    const signedInfo = `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#"><CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/><SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/><Reference URI="#${referenceUriId}"><Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/></Transforms><DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/><DigestValue>${digestValue}</DigestValue></Reference></SignedInfo>`;

    // 3. Firmar el <SignedInfo> con la llave privada del emisor usando RSA-SHA1
    const canonicalSignedInfo = this.canonicalize(signedInfo);
    const sign = crypto.createSign('RSA-SHA1');
    sign.update(canonicalSignedInfo, 'utf8');
    const signatureValue = sign.sign(cert.privateKeyPem, 'base64');

    // 4. Bloque <Signature> estándar W3C requerido por el SII
    const signatureXml = `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">${signedInfo}<SignatureValue>${signatureValue}</SignatureValue><KeyInfo><KeyValue><RSAKeyValue><Modulus>${cert.modulusBase64}</Modulus><Exponent>${cert.exponentBase64}</Exponent></RSAKeyValue></KeyValue><X509Data><X509Certificate>${cert.certificatePem}</X509Certificate></X509Data></KeyInfo></Signature>`;

    return signatureXml;
  }

  /**
   * Valida la firma criptográfica de un bloque <Signature> sobre un contenido dado
   */
  public verifySignature(xmlContent: string, signatureValueBase64: string, publicKeyPem: string): boolean {
    try {
      const canonical = this.canonicalize(xmlContent);
      const verify = crypto.createVerify('RSA-SHA1');
      verify.update(canonical, 'utf8');
      return verify.verify(publicKeyPem, signatureValueBase64, 'base64');
    } catch {
      return false;
    }
  }
}

export const defaultXmlSigner = new XmlSignerService();

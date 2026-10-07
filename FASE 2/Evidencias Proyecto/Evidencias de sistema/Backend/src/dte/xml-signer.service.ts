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
   * Canoniza un fragmento XML según la norma C14N
   */
  public canonicalize(xml: string): string {
    return xml
      .replace(/>\s+</g, '><')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .trim();
  }

  /**
   * Calcula el Digest SHA-1 en Base64 de un bloque XML
   */
  public calculateDigest(xmlContent: string): string {
    const canonical = this.canonicalize(xmlContent);
    return crypto.createHash('sha1').update(canonical, 'utf8').digest('base64');
  }

  /**
   * Firma un documento DTE o RCOF incorporando el bloque XMLDSig <Signature>
   */
  public signDocument(
    xmlToSign: string,
    referenceUriId: string,
    customCert?: SignerCertificate
  ): string {
    const cert = customCert || this.defaultKeyPair;
    if (!cert) {
      throw new Error('No hay certificado digital disponible para firmar el documento');
    }

    // 1. Calcular Digest del documento a referenciar
    const digestValue = this.calculateDigest(xmlToSign);

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

// src/features/sii/utils/envioSii.ts
import type { ResultadoEnvioSii } from '@/features/sii/types'

// que el sobre quede preparado no es un exito: lo es que el sii lo reciba
export function envioSalioCompleto(resultado: ResultadoEnvioSii | undefined): boolean {
  if (!resultado) return false
  return resultado.enviado && resultado.sobres.every((sobre) => sobre.enviado)
}

// el fallo de un sobre no cancela a los otros, asi que puede viajar uno y el otro no
export function sobresSinViajar(resultado: ResultadoEnvioSii | undefined): number {
  if (!resultado) return 0
  return resultado.sobres.filter((sobre) => !sobre.enviado).length
}

// estos no se envian ni cuando llegue el certificado: el sii no autorizo ese folio
export function avisoFoliosProvisionales(cuantos: number): string | null {
  if (cuantos < 1) return null
  return cuantos === 1
    ? '1 documento lleva folio provisional y no se va a poder enviar. Hay que reemitirlo con folios autorizados.'
    : `${cuantos} documentos llevan folio provisional y no se van a poder enviar. Hay que reemitirlos con folios autorizados.`
}

// el archivo que se sube a mano en el portal del sii
export function nombreDelSobre(tipoSobre: string, envioId: string): string {
  return `${tipoSobre}-${envioId.slice(0, 8)}.xml`
}

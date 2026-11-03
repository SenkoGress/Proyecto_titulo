// src/features/pos/utils/avisoDocumentos.ts
import type { RespaldoDocumentos } from '../types'

// en_proceso_ocr no se avisa: el documento esta esperando digitalizacion y se resuelve solo
export function avisoDocumentos(respaldo: RespaldoDocumentos | undefined): string | null {
  if (!respaldo) return null

  const partes: string[] = []

  if (respaldo.pendientes > 0) {
    partes.push(
      respaldo.pendientes === 1
        ? 'Queda 1 documento de factura sin respaldar, y sube al sincronizar de nuevo.'
        : `Quedan ${respaldo.pendientes} documentos de factura sin respaldar, y suben al sincronizar de nuevo.`
    )
  }

  // a estos les falta el archivo, no el respaldo: el dueño los tiene que volver a subir
  if (respaldo.sin_archivo > 0) {
    partes.push(
      respaldo.sin_archivo === 1
        ? '1 documento de factura perdio su archivo y hay que subirlo de nuevo.'
        : `${respaldo.sin_archivo} documentos de factura perdieron su archivo y hay que subirlos de nuevo.`
    )
  }

  if (respaldo.fallidos_ocr > 0) {
    partes.push(
      respaldo.fallidos_ocr === 1
        ? '1 documento de factura no se pudo leer y hay que ingresarlo de nuevo.'
        : `${respaldo.fallidos_ocr} documentos de factura no se pudieron leer y hay que ingresarlos de nuevo.`
    )
  }

  return partes.length > 0 ? ` ${partes.join(' ')}` : null
}

// un archivo perdido o un documento ilegible no se arregla sincronizando, asi que no va en verde
export function documentosNecesitanAtencion(respaldo: RespaldoDocumentos | undefined): boolean {
  if (!respaldo) return false
  return respaldo.sin_archivo > 0 || respaldo.fallidos_ocr > 0
}

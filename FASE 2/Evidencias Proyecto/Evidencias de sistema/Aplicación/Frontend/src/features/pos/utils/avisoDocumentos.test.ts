// src/features/pos/utils/avisoDocumentos.test.ts
import { describe, expect, it } from 'vitest'
import { avisoDocumentos, documentosNecesitanAtencion } from '@/features/pos/utils/avisoDocumentos'
import type { RespaldoDocumentos } from '@/features/pos/types'

// desde el 03-11 el servidor separa los documentos segun lo que le falta a cada uno
function respaldo(parcial: Partial<RespaldoDocumentos>): RespaldoDocumentos {
  return {
    respaldados: 0,
    omitidos: 0,
    pendientes: 0,
    sin_archivo: 0,
    en_proceso_ocr: 0,
    fallidos_ocr: 0,
    ...parcial,
  }
}

describe('avisoDocumentos', () => {
  it('no avisa nada cuando no quedo ninguno', () => {
    expect(avisoDocumentos(respaldo({ respaldados: 3 }))).toBeNull()
  })

  it('no avisa nada cuando el servidor no mando el desglose', () => {
    expect(avisoDocumentos(undefined)).toBeNull()
  })

  it('dice que los pendientes suben al sincronizar de nuevo', () => {
    expect(avisoDocumentos(respaldo({ pendientes: 2 }))).toBe(
      ' Quedan 2 documentos de factura sin respaldar, y suben al sincronizar de nuevo.'
    )
  })

  it('concuerda en singular con un solo pendiente', () => {
    expect(avisoDocumentos(respaldo({ pendientes: 1 }))).toBe(
      ' Queda 1 documento de factura sin respaldar, y sube al sincronizar de nuevo.'
    )
  })

  it('al que perdio su archivo le pide subirlo de nuevo, no sincronizar', () => {
    expect(avisoDocumentos(respaldo({ sin_archivo: 3 }))).toBe(
      ' 3 documentos de factura perdieron su archivo y hay que subirlos de nuevo.'
    )
  })

  it('al ilegible le pide ingresarlo de nuevo', () => {
    expect(avisoDocumentos(respaldo({ fallidos_ocr: 1 }))).toBe(
      ' 1 documento de factura no se pudo leer y hay que ingresarlo de nuevo.'
    )
  })

  it('calla los que estan esperando digitalizacion, porque se resuelven solos', () => {
    expect(avisoDocumentos(respaldo({ en_proceso_ocr: 4 }))).toBeNull()
  })

  it('junta los tres avisos sin repetir el que no corresponde', () => {
    const texto = avisoDocumentos(respaldo({ pendientes: 1, sin_archivo: 3, fallidos_ocr: 1 }))
    expect(texto).toBe(
      ' Queda 1 documento de factura sin respaldar, y sube al sincronizar de nuevo.' +
        ' 3 documentos de factura perdieron su archivo y hay que subirlos de nuevo.' +
        ' 1 documento de factura no se pudo leer y hay que ingresarlo de nuevo.'
    )
  })
})

describe('documentosNecesitanAtencion', () => {
  it('un pendiente no necesita atencion: basta volver a sincronizar', () => {
    expect(documentosNecesitanAtencion(respaldo({ pendientes: 5 }))).toBe(false)
  })

  it('un archivo perdido si la necesita', () => {
    expect(documentosNecesitanAtencion(respaldo({ sin_archivo: 1 }))).toBe(true)
  })

  it('un documento ilegible si la necesita', () => {
    expect(documentosNecesitanAtencion(respaldo({ fallidos_ocr: 1 }))).toBe(true)
  })

  it('sin desglose no se afirma que haya un problema', () => {
    expect(documentosNecesitanAtencion(undefined)).toBe(false)
  })
})

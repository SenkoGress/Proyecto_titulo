// src/features/sii/utils/envioSii.test.ts
import { describe, expect, it } from 'vitest'
import {
  avisoFoliosProvisionales,
  envioSalioCompleto,
  nombreDelSobre,
  sobresSinViajar,
} from '@/features/sii/utils/envioSii'
import type { ResultadoEnvioSii, SobreEnviado } from '@/features/sii/types'

function sobre(tipo: string, enviado: boolean): SobreEnviado {
  return { envio_id: `${tipo}-0000`, tipo_sobre: tipo, documentos: 1, enviado }
}

function resultado(enviado: boolean, sobres: SobreEnviado[]): ResultadoEnvioSii {
  return { enviado, mensaje: '', documentos: sobres.length, sobres, faltantes: [] }
}

describe('envioSalioCompleto', () => {
  it('es exito cuando el sii recibio los dos sobres', () => {
    expect(envioSalioCompleto(resultado(true, [sobre('EnvioDTE', true), sobre('EnvioBOLETA', true)]))).toBe(true)
  })

  it('no es exito si uno de los dos se quedo', () => {
    expect(envioSalioCompleto(resultado(true, [sobre('EnvioDTE', true), sobre('EnvioBOLETA', false)]))).toBe(false)
  })

  it('no es exito cuando el sobre solo quedo preparado', () => {
    expect(envioSalioCompleto(resultado(false, [sobre('EnvioDTE', false)]))).toBe(false)
  })

  it('sin respuesta no se afirma que haya salido', () => {
    expect(envioSalioCompleto(undefined)).toBe(false)
  })
})

describe('sobresSinViajar', () => {
  it('cuenta los que no llegaron', () => {
    expect(sobresSinViajar(resultado(true, [sobre('EnvioDTE', true), sobre('EnvioBOLETA', false)]))).toBe(1)
  })

  it('da cero cuando viajaron todos', () => {
    expect(sobresSinViajar(resultado(true, [sobre('EnvioDTE', true)]))).toBe(0)
  })
})

describe('avisoFoliosProvisionales', () => {
  it('no avisa cuando no hay ninguno', () => {
    expect(avisoFoliosProvisionales(0)).toBeNull()
  })

  it('concuerda en singular', () => {
    expect(avisoFoliosProvisionales(1)).toContain('1 documento lleva folio provisional')
  })

  it('dice que hay que reemitirlos, no reintentarlos', () => {
    expect(avisoFoliosProvisionales(17)).toBe(
      '17 documentos llevan folio provisional y no se van a poder enviar. Hay que reemitirlos con folios autorizados.'
    )
  })
})

describe('nombreDelSobre', () => {
  it('nombra el archivo por su tipo, porque pueden ser dos', () => {
    expect(nombreDelSobre('EnvioBOLETA', '346fd01a-aaaa-bbbb-cccc-dddddddddddd')).toBe('EnvioBOLETA-346fd01a.xml')
  })
})

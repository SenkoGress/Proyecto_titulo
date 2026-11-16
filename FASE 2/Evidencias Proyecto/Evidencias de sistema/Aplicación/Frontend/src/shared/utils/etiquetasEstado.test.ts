// src/shared/utils/etiquetasEstado.test.ts
import { describe, expect, it } from 'vitest'
import {
  etiquetaAmbienteSii,
  etiquetaDocumentoVenta,
  etiquetaEstadoFactura,
  etiquetaEstadoSii,
  etiquetaMetodoIngreso,
} from '@/shared/utils/etiquetasEstado'

describe('etiquetaEstadoFactura', () => {
  it('traduce los dos nombres del mismo estado', () => {
    expect(etiquetaEstadoFactura('PROCESSED').texto).toBe('Procesada')
    expect(etiquetaEstadoFactura('PROCESADA').texto).toBe('Procesada')
  })

  it('la lectura fallida no se pinta de verde', () => {
    expect(etiquetaEstadoFactura('FALLIDA_OCR').tono).toBe('error')
  })

  it('guarda el codigo crudo para el modo tecnico', () => {
    expect(etiquetaEstadoFactura('PROCESSED').codigo).toBe('PROCESSED')
  })
})

describe('etiquetaMetodoIngreso', () => {
  it('traduce la lectura por ia', () => {
    expect(etiquetaMetodoIngreso('OCR_GEMINI_AI').texto).toBe('Leida por IA')
  })

  it('avisa que la lectura de prueba no es real', () => {
    expect(etiquetaMetodoIngreso('OCR_MOCK_PARSER').tono).toBe('warning')
  })
})

describe('etiquetaEstadoSii', () => {
  it('distingue emitido de aceptado', () => {
    expect(etiquetaEstadoSii('EMITIDO_LOCAL').texto).toBe('Emitido en el local')
    expect(etiquetaEstadoSii('ACEPTADO_SII').texto).toBe('Aceptado por el SII')
  })

  it('el rechazo del sii queda en rojo', () => {
    expect(etiquetaEstadoSii('RECHAZADO_SII').tono).toBe('error')
  })
})

describe('etiquetaAmbienteSii', () => {
  it('nombra los servidores del sii sin decir maullin', () => {
    expect(etiquetaAmbienteSii('CERTIFICACION_MAULLIN').texto).toBe('Ambiente de certificacion')
    expect(etiquetaAmbienteSii('PRODUCCION_PALENA').texto).toBe('Ambiente de produccion')
  })
})

describe('etiquetaDocumentoVenta', () => {
  // el backend marca cualquier tarjeta como VOUCHER_TRANSBANK, tambien SumUp y Mercado Pago
  it('el voucher de tarjeta no nombra a transbank', () => {
    expect(etiquetaDocumentoVenta('VOUCHER_TRANSBANK').texto).toBe('Comprobante de pago con tarjeta')
  })

  it('la boleta se nombra como boleta', () => {
    expect(etiquetaDocumentoVenta('BOLETA_ELECTRONICA').texto).toBe('Boleta electronica')
  })
})

describe('codigos que la tabla no conoce', () => {
  // el backend puede sumar estados nuevos: mostrar el codigo es mejor que esconderlo
  it('muestra el codigo tal cual', () => {
    expect(etiquetaEstadoSii('ANULADO_POR_SII')).toEqual({
      texto: 'ANULADO_POR_SII',
      tono: 'default',
      codigo: 'ANULADO_POR_SII',
    })
  })

  it('sin estado no inventa uno', () => {
    expect(etiquetaEstadoFactura(null).texto).toBe('Sin estado')
    expect(etiquetaEstadoFactura('   ').texto).toBe('Sin estado')
  })
})

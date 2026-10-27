// src/features/invoices/utils/facturaDuplicada.test.ts
import { describe, expect, it } from 'vitest'
import { facturaYaIngresada } from '@/features/invoices/utils/facturaDuplicada'
import type { FacturaRegistrada } from '@/features/invoices/types'

function registrada(campos: Partial<FacturaRegistrada>): FacturaRegistrada {
  return {
    id: 'f1',
    numero_factura: '11354',
    rut_proveedor: '78.450.685-1',
    proveedor_nombre: 'Froneri Chile SpA',
    fecha_ingreso: '2026-10-14',
    ...campos,
  } as FacturaRegistrada
}

const historial = [registrada({})]

describe('facturaYaIngresada', () => {
  it('encuentra la factura que ya entro', () => {
    expect(facturaYaIngresada('11354', '78.450.685-1', historial)?.id).toBe('f1')
  })

  // el motor a veces lee el rut con puntos y a veces sin ellos
  it('no se confunde por los puntos del rut', () => {
    expect(facturaYaIngresada('11354', '784506851', historial)).not.toBeNull()
  })

  it('no se confunde por los ceros a la izquierda del folio', () => {
    expect(facturaYaIngresada('011354', '78.450.685-1', historial)).not.toBeNull()
  })

  // el mismo folio de otro proveedor es una factura distinta
  it('deja pasar el mismo folio de otro proveedor', () => {
    expect(facturaYaIngresada('11354', '76.123.456-8', historial)).toBeNull()
  })

  it('deja pasar un folio que no existe', () => {
    expect(facturaYaIngresada('99999', '78.450.685-1', historial)).toBeNull()
  })

  // sin folio no hay con que comparar, y avisar seria peor que no avisar
  it('no avisa cuando la factura no trae folio', () => {
    expect(facturaYaIngresada(null, '78.450.685-1', historial)).toBeNull()
    expect(facturaYaIngresada('  ', '78.450.685-1', historial)).toBeNull()
  })
})

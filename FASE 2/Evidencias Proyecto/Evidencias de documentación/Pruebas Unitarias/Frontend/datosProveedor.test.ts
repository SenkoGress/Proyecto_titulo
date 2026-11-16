// src/features/invoices/utils/datosProveedor.test.ts
import { describe, expect, it } from 'vitest'
import { camposParaConfirmar, datosDesdeFactura, faltanDatos } from '@/features/invoices/utils/datosProveedor'
import type { PrevisualizacionFactura } from '@/features/invoices/types'

const factura = (cambios: Partial<PrevisualizacionFactura>) =>
  ({ rut_proveedor: '76.543.210-3', razon_social: 'Distribuidora', ...cambios }) as PrevisualizacionFactura

describe('datos del proveedor de una factura', () => {
  it('lo que la factura no trae queda en blanco, sin inventar nada', () => {
    expect(datosDesdeFactura(factura({ giro_proveedor: 'Abarrotes' }))).toEqual({
      giro: 'Abarrotes',
      direccion: '',
      telefono: '',
      email: '',
      dias_visita: '',
    })
  })

  it('la ventana se abre sola solo para un proveedor nuevo al que le falta algo', () => {
    expect(faltanDatos(factura({ es_proveedor_nuevo: true }))).toBe(true)
    expect(faltanDatos(factura({ es_proveedor_nuevo: false }))).toBe(false)
    expect(
      faltanDatos(
        factura({
          es_proveedor_nuevo: true,
          giro_proveedor: 'Abarrotes',
          direccion_proveedor: 'Av. Uno 123',
          telefono_proveedor: '+56 9 1234 5678',
          email_proveedor: 'ventas@distribuidora.cl',
          dias_visita_proveedor: 'Martes',
        }),
      ),
    ).toBe(false)
  })

  it('un campo en blanco no se manda al confirmar', () => {
    const campos = camposParaConfirmar({ giro: ' Abarrotes ', direccion: '', telefono: '  ', email: 'a@b.cl', dias_visita: '' })
    expect(campos).toEqual({
      giro_proveedor: 'Abarrotes',
      direccion_proveedor: undefined,
      telefono_proveedor: undefined,
      email_proveedor: 'a@b.cl',
      dias_visita_proveedor: undefined,
    })
  })
})

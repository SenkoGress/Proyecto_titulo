// src/features/ventas/utils/sincronizacionVenta.test.ts
import { describe, expect, it } from 'vitest'
import {
  avisoVentasSinSubir,
  contarSinSubir,
  estadoEnLaNube,
  noSubio,
} from '@/features/ventas/utils/sincronizacionVenta'
import type { FilaVenta } from '@/features/ventas/utils/filaVenta'

function venta(sync_status: string): FilaVenta {
  return { sync_status } as FilaVenta
}

describe('noSubio', () => {
  it('la que esta en la nube no cuenta', () => {
    expect(noSubio(venta('SYNCED'))).toBe(false)
  })

  it('cuenta la rechazada y la que todavia no viaja', () => {
    expect(noSubio(venta('FAILED'))).toBe(true)
    expect(noSubio(venta('PENDING'))).toBe(true)
  })

  // el backend escribe SYNCED, pero una venta vieja puede traer el campo vacio
  it('sin estado se considera que no subio', () => {
    expect(noSubio(venta(''))).toBe(true)
    expect(noSubio({} as FilaVenta)).toBe(true)
  })
})

describe('contarSinSubir', () => {
  it('cuenta solo las que faltan', () => {
    const ventas = [venta('SYNCED'), venta('FAILED'), venta('PENDING'), venta('SYNCED')]
    expect(contarSinSubir(ventas)).toBe(2)
  })
})

describe('estadoEnLaNube', () => {
  it('distingue la rechazada de la que esta por subir', () => {
    expect(estadoEnLaNube(venta('FAILED')).texto).toBe('No subio')
    expect(estadoEnLaNube(venta('FAILED')).tono).toBe('error')
    expect(estadoEnLaNube(venta('PENDING')).texto).toBe('Por subir')
    expect(estadoEnLaNube(venta('PENDING')).tono).toBe('warning')
  })

  it('la respaldada queda en verde', () => {
    expect(estadoEnLaNube(venta('SYNCED')).tono).toBe('success')
  })
})

describe('avisoVentasSinSubir', () => {
  it('sin ventas pendientes no hay aviso', () => {
    expect(avisoVentasSinSubir(0)).toBeNull()
  })

  it('concuerda en singular y en plural', () => {
    expect(avisoVentasSinSubir(1)).toContain('Hay 1 venta que no esta')
    expect(avisoVentasSinSubir(3)).toContain('Hay 3 ventas que no estan')
  })
})

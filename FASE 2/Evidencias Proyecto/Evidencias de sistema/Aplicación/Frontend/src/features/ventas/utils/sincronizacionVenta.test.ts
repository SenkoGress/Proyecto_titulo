// src/features/ventas/utils/sincronizacionVenta.test.ts
import { describe, expect, it } from 'vitest'
import {
  avisoVentasSinSubir,
  contarDetenidas,
  contarSinSubir,
  estaDetenida,
  estadoEnLaNube,
  noSubio,
} from '@/features/ventas/utils/sincronizacionVenta'
import type { FilaVenta } from '@/features/ventas/utils/filaVenta'

function venta(sync_status: string, sync_detenida = 0, sync_attempts = 0): FilaVenta {
  return { sync_status, sync_detenida, sync_attempts } as FilaVenta
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

  // la que fallo pero aun reintenta no es lo mismo que la que se rindio
  it('la detenida se nombra distinto de la que todavia reintenta', () => {
    expect(estadoEnLaNube(venta('FAILED', 1, 5)).texto).toBe('Detenida')
    expect(estadoEnLaNube(venta('FAILED', 0, 2)).texto).toBe('No subio')
  })

  it('la detenida dice cuantos intentos gasto', () => {
    expect(estadoEnLaNube(venta('FAILED', 1, 5)).detalle).toContain('5 intentos')
  })
})

describe('estaDetenida', () => {
  it('solo cuenta la que el backend marco como detenida', () => {
    expect(estaDetenida(venta('FAILED', 1))).toBe(true)
    expect(estaDetenida(venta('FAILED', 0))).toBe(false)
    expect(estaDetenida(venta('SYNCED'))).toBe(false)
  })

  it('cuenta las detenidas de una lista', () => {
    expect(contarDetenidas([venta('FAILED', 1), venta('FAILED', 0), venta('SYNCED')])).toBe(1)
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

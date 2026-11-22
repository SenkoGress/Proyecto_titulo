// src/features/caja/utils/correccionCierre.test.ts
import { describe, expect, it } from 'vitest'
import {
  conteoVigente,
  diferenciaVigente,
  estaCorregido,
  sePuedeCorregir,
} from '@/features/caja/utils/correccionCierre'
import type { CierreHistorial } from '@/features/caja/types'

const cerrado = {
  estado: 'CERRADA',
  monto_real_efectivo: 78000,
  diferencia_efectivo: -430,
  monto_corregido_efectivo: null,
  diferencia_corregida: null,
} as CierreHistorial

const corregido = {
  ...cerrado,
  monto_corregido_efectivo: 78430,
  diferencia_corregida: 0,
} as CierreHistorial

describe('conteoVigente', () => {
  it('sin correccion vale el conteo original', () => {
    expect(conteoVigente(cerrado)).toBe(78000)
  })

  it('con correccion vale el corregido', () => {
    expect(conteoVigente(corregido)).toBe(78430)
  })

  it('un turno abierto todavia no tiene conteo', () => {
    expect(conteoVigente({ ...cerrado, estado: 'ABIERTA', monto_real_efectivo: null } as CierreHistorial)).toBeNull()
  })
})

describe('diferenciaVigente', () => {
  it('sin correccion vale la diferencia original', () => {
    expect(diferenciaVigente(cerrado)).toBe(-430)
  })

  // una correccion que deja la caja cuadrada da cero, y cero no se confunde con "sin dato"
  it('con correccion vale la corregida, aunque sea cero', () => {
    expect(diferenciaVigente(corregido)).toBe(0)
  })
})

describe('estaCorregido', () => {
  it('distingue el cierre corregido del que no', () => {
    expect(estaCorregido(cerrado)).toBe(false)
    expect(estaCorregido(corregido)).toBe(true)
  })
})

describe('sePuedeCorregir', () => {
  it('solo el administrador', () => {
    expect(sePuedeCorregir(cerrado, true)).toBe(true)
    expect(sePuedeCorregir(cerrado, false)).toBe(false)
  })

  // el servidor responde 409 TURNO_ABIERTO: primero se cierra
  it('un turno abierto no se corrige', () => {
    expect(sePuedeCorregir({ ...cerrado, estado: 'ABIERTA' } as CierreHistorial, true)).toBe(false)
  })

  it('un cierre ya corregido se puede corregir de nuevo', () => {
    expect(sePuedeCorregir(corregido, true)).toBe(true)
  })
})

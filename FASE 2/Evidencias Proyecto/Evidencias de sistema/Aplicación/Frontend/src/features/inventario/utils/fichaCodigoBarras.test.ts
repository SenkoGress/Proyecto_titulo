// src/features/inventario/utils/fichaCodigoBarras.test.ts
import { describe, expect, it } from 'vitest'
import {
  codigoBuscable,
  fichaAprovechable,
  nombreSugerido,
} from '@/features/inventario/utils/fichaCodigoBarras'
import type { FichaExterna } from '@/features/inventario/utils/fichaCodigoBarras'

function ficha(parcial: Partial<FichaExterna>): FichaExterna {
  return {
    codigo: '7801610001196',
    nombre: null,
    marca: null,
    contenido: null,
    imagen: null,
    fuente: 'Open Food Facts',
    ...parcial,
  }
}

describe('codigoBuscable', () => {
  it('acepta los largos que el servidor acepta', () => {
    expect(codigoBuscable('12345678')).toBe(true)
    expect(codigoBuscable('7801610001196')).toBe(true)
    expect(codigoBuscable('12345678901234')).toBe(true)
  })

  it('rechaza lo que el servidor rechazaria, sin salir a internet', () => {
    expect(codigoBuscable('1234567')).toBe(false)
    expect(codigoBuscable('123456789012345')).toBe(false)
    expect(codigoBuscable('780161000119X')).toBe(false)
    expect(codigoBuscable('')).toBe(false)
  })

  it('no se cae por los espacios que deja una pistola lectora', () => {
    expect(codigoBuscable('  7801610001196  ')).toBe(true)
  })
})

describe('nombreSugerido', () => {
  // el catalogo nombra asi los productos que entran por factura
  it('arma marca, nombre y contenido en una linea', () => {
    expect(nombreSugerido(ficha({ marca: 'Colun', nombre: 'Leche Entera', contenido: '1 L' }))).toBe(
      'Colun Leche Entera 1 L',
    )
  })

  it('salta las partes que la base no trae', () => {
    expect(nombreSugerido(ficha({ nombre: 'Leche Entera' }))).toBe('Leche Entera')
    expect(nombreSugerido(ficha({ marca: 'Colun', contenido: '1 L' }))).toBe('Colun 1 L')
  })

  it('no deja espacios de sobra cuando un campo viene vacio', () => {
    expect(nombreSugerido(ficha({ marca: '  ', nombre: 'Leche', contenido: '' }))).toBe('Leche')
  })
})

describe('fichaAprovechable', () => {
  // el 29% de los registros chilenos esta a medio llenar: una ficha sin nombre no se ofrece
  it('una ficha sin nada que mostrar no sirve', () => {
    expect(fichaAprovechable(ficha({}))).toBe(false)
  })

  it('con nombre ya sirve', () => {
    expect(fichaAprovechable(ficha({ nombre: 'Leche Entera' }))).toBe(true)
  })
})

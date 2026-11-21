// src/features/auth/utils/permisos.test.ts
import { describe, expect, it } from 'vitest'
import { destinoTrasEntrar, esRutaDeAdmin, nombreRol, puedeEntrar } from '@/features/auth/utils/permisos'

describe('esRutaDeAdmin', () => {
  it('reconoce las pantallas de margenes, compras y tributario', () => {
    expect(esRutaDeAdmin('/dashboard')).toBe(true)
    expect(esRutaDeAdmin('/facturas')).toBe(true)
    expect(esRutaDeAdmin('/sii')).toBe(true)
  })

  it('la caja y la configuracion no son solo del admin', () => {
    expect(esRutaDeAdmin('/')).toBe(false)
    expect(esRutaDeAdmin('/configuracion')).toBe(false)
  })
})

describe('puedeEntrar', () => {
  it('el admin entra a todo', () => {
    expect(puedeEntrar('admin', '/dashboard')).toBe(true)
    expect(puedeEntrar('admin', '/')).toBe(true)
  })

  it('el cajero no entra a las del admin', () => {
    expect(puedeEntrar('cajero', '/dashboard')).toBe(false)
    expect(puedeEntrar('cajero', '/reabastecimiento')).toBe(false)
  })

  it('el cajero si entra a la caja y a las ventas', () => {
    expect(puedeEntrar('cajero', '/')).toBe(true)
    expect(puedeEntrar('cajero', '/ventas')).toBe(true)
  })
})

// en la prueba con usuarios, al entrar como cajero la aplicacion abrio en Configuracion: era la
// pantalla donde habia quedado la sesion anterior
describe('destinoTrasEntrar', () => {
  it('el cajero entra siempre a la caja, aunque quede otra pantalla abierta', () => {
    expect(destinoTrasEntrar('cajero', '/configuracion')).toBe('/')
    expect(destinoTrasEntrar('cajero', '/ventas')).toBe('/')
  })

  it('el admin vuelve a donde iba', () => {
    expect(destinoTrasEntrar('admin', '/facturas')).toBe('/facturas')
  })

  it('sin pantalla anterior, los dos entran a la caja', () => {
    expect(destinoTrasEntrar('admin', undefined)).toBe('/')
    expect(destinoTrasEntrar('cajero', undefined)).toBe('/')
  })

  it('no devuelve al login, que daria una vuelta sin salida', () => {
    expect(destinoTrasEntrar('admin', '/login')).toBe('/')
  })

  it('sin rol todavia, entra a la caja', () => {
    expect(destinoTrasEntrar(undefined, '/dashboard')).toBe('/')
  })
})

describe('nombreRol', () => {
  it('traduce el rol a como se lee en pantalla', () => {
    expect(nombreRol('admin')).toBe('Administrador')
    expect(nombreRol('cajero')).toBe('Cajero')
  })
})

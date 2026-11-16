// src/shared/utils/papelTermico.test.ts
import { describe, expect, it } from 'vitest'
import {
  anchoVistaPx,
  esAnchoPapel,
  reglaPagina,
  tamanoLetraPx,
} from '@/shared/utils/papelTermico'

describe('esAnchoPapel', () => {
  it('acepta los dos rollos que existen', () => {
    expect(esAnchoPapel(58)).toBe(true)
    expect(esAnchoPapel(80)).toBe(true)
  })

  it('rechaza cualquier otro ancho, incluso si viene como texto', () => {
    expect(esAnchoPapel(76)).toBe(false)
    expect(esAnchoPapel('80')).toBe(false)
    expect(esAnchoPapel(undefined)).toBe(false)
  })
})

describe('anchoVistaPx', () => {
  it('deja el rollo de 80mm como estaba antes de poder elegir', () => {
    expect(anchoVistaPx(80)).toBe(320)
  })

  it('reduce la vista en la misma proporcion del rollo', () => {
    expect(anchoVistaPx(58)).toBe(232)
  })
})

describe('tamanoLetraPx', () => {
  it('baja la letra en el rollo angosto, donde entra menos texto', () => {
    expect(tamanoLetraPx(58)).toBeLessThan(tamanoLetraPx(80))
  })
})

describe('reglaPagina', () => {
  it('pide el alto automatico, porque el ticket no tiene largo fijo', () => {
    expect(reglaPagina(80)).toBe('@page { size: 80mm auto; margin: 4mm; }')
  })

  it('cambia solo el ancho al elegir el otro rollo', () => {
    expect(reglaPagina(58)).toBe('@page { size: 58mm auto; margin: 4mm; }')
  })
})

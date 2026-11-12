// src/shared/utils/reducirImagen.test.ts
import { describe, expect, it } from 'vitest'
import { formatoAceptado, medidaReducida, motivoArchivoInvalido } from '@/shared/utils/reducirImagen'

// archivo falso: solo interesan tipo y tamano, que es lo que se revisa antes de leerlo
function archivo(tipo: string, bytes: number): File {
  const falso = new File([''], 'foto', { type: tipo })
  Object.defineProperty(falso, 'size', { value: bytes })
  return falso
}

describe('medidaReducida', () => {
  it('lleva el lado mayor a 400 y mantiene la proporcion', () => {
    expect(medidaReducida(2000, 1000)).toEqual({ ancho: 400, alto: 200 })
    expect(medidaReducida(1000, 2000)).toEqual({ ancho: 200, alto: 400 })
  })

  it('no agranda una foto que ya es chica', () => {
    expect(medidaReducida(120, 90)).toEqual({ ancho: 120, alto: 90 })
  })

  it('deja al menos un pixel en la foto muy alargada', () => {
    expect(medidaReducida(4000, 3).alto).toBe(1)
  })

  it('devuelve cero con medidas invalidas', () => {
    expect(medidaReducida(0, 500)).toEqual({ ancho: 0, alto: 0 })
  })
})

describe('formatoAceptado', () => {
  it('acepta los tres formatos que acepta el servidor', () => {
    expect(formatoAceptado('image/jpeg')).toBe(true)
    expect(formatoAceptado('image/png')).toBe(true)
    expect(formatoAceptado('image/webp')).toBe(true)
  })

  it('rechaza lo que el servidor no guarda', () => {
    expect(formatoAceptado('image/gif')).toBe(false)
    expect(formatoAceptado('application/pdf')).toBe(false)
  })
})

describe('motivoArchivoInvalido', () => {
  it('no se queja de una foto de camara normal', () => {
    expect(motivoArchivoInvalido(archivo('image/jpeg', 3 * 1024 * 1024))).toBeNull()
  })

  it('avisa del formato', () => {
    expect(motivoArchivoInvalido(archivo('image/gif', 1000))).toMatch(/JPEG, PNG o WebP/)
  })

  it('avisa del peso antes de leer el archivo', () => {
    expect(motivoArchivoInvalido(archivo('image/jpeg', 25 * 1024 * 1024))).toMatch(/20 MB/)
  })
})

// src/lib/api/apiError.test.ts
import { describe, expect, it } from 'vitest'
import { AxiosError } from 'axios'
import { obtenerMensajeError } from '@/lib/api/apiError'

function respuesta(status: number, message?: string): AxiosError {
  const error = new AxiosError('fallo')
  error.response = { status, data: message ? { message } : {} } as AxiosError['response']
  return error
}

describe('obtenerMensajeError', () => {
  it('avisa cuando el servidor no responde', () => {
    expect(obtenerMensajeError(new AxiosError('sin red'))).toContain('No se pudo conectar')
  })

  // el dueño del local no tiene que leer nombres de tablas ni restricciones
  it('no muestra el detalle tecnico de un error del servidor', () => {
    const tecnico = 'insert or update on table "detalle_venta" violates foreign key constraint'
    const mensaje = obtenerMensajeError(respuesta(500, tecnico))

    expect(mensaje).not.toContain('detalle_venta')
    expect(mensaje).not.toContain('foreign key')
    expect(mensaje).toContain('Intenta de nuevo')
  })

  it('tampoco lo muestra si el servidor no esta disponible', () => {
    expect(obtenerMensajeError(respuesta(503, 'ECONNREFUSED 127.0.0.1:5432'))).not.toContain('5432')
  })

  // estos si los escribimos nosotros y le sirven al usuario
  it('deja pasar el mensaje del backend cuando es del usuario', () => {
    expect(obtenerMensajeError(respuesta(403, 'No tienes permiso'))).toBe('No tienes permiso')
    expect(obtenerMensajeError(respuesta(400, 'Falta el folio'))).toBe('Falta el folio')
  })

  it('explica el limite de peticiones en vez de mostrar un codigo', () => {
    expect(obtenerMensajeError(respuesta(429))).toContain('demasiadas peticiones')
  })
})

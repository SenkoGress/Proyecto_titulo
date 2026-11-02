// src/features/pos/utils/resumenSincronizacion.test.ts
import { describe, expect, it } from 'vitest'
import { AxiosError, AxiosHeaders } from 'axios'
import { resumenSincronizacion } from '@/features/pos/utils/resumenSincronizacion'

// el backend responde 500 aunque algunas ventas si hayan subido
function errorDeSync(syncedIds: string[], failedIds: string[]): AxiosError {
  const error = new AxiosError('Request failed with status code 500')
  error.response = {
    status: 500,
    statusText: 'Internal Server Error',
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: {
      success: false,
      message: 'Fallo en sincronización: Se sincronizaron 1 de 2 ventas.',
      result: { success: false, synced_ids: syncedIds, failed_ids: failedIds },
    },
  }
  return error
}

describe('resumenSincronizacion', () => {
  it('dice cuantas subieron cuando la subida fue parcial', () => {
    const texto = resumenSincronizacion(errorDeSync(['a', 'b', 'c'], ['d', 'e']))
    expect(texto).toBe(
      'Subieron 3 de 5 ventas. Las otras 2 siguen guardadas aca y se suben al sincronizar de nuevo.'
    )
  })

  it('concuerda en singular cuando subio una y quedo una', () => {
    expect(resumenSincronizacion(errorDeSync(['a'], ['b']))).toBe(
      'Subio 1 de 2 ventas. La otra sigue guardada aca y se sube al sincronizar de nuevo.'
    )
  })

  // el caso que el aviso trataba mal: afirmaba que no subio nada
  it('no dice que no subio nada cuando si subio parte', () => {
    expect(resumenSincronizacion(errorDeSync(['a'], ['b']))).not.toContain('No subio')
  })

  it('avisa cuando no subio ninguna', () => {
    expect(resumenSincronizacion(errorDeSync([], ['a', 'b']))).toBe(
      'No subio ninguna venta. Las 2 siguen guardadas en este equipo.'
    )
    expect(resumenSincronizacion(errorDeSync([], ['a']))).toBe(
      'No subio la venta pendiente. Sigue guardada en este equipo.'
    )
  })

  // el motivo que manda el servidor nombra tablas y restricciones de la base
  it('no muestra el detalle tecnico de la falla', () => {
    const texto = resumenSincronizacion(errorDeSync(['a'], ['b']))
    expect(texto).not.toContain('Fallo en sincronización')
  })

  // sin red no hay respuesta, asi que no se puede afirmar que algo subio
  it('cae al mensaje generico cuando no hay detalle', () => {
    const texto = resumenSincronizacion(new AxiosError('Network Error'))
    expect(texto).toContain('No se pudo conectar con el servidor')
    expect(texto).toContain('Las ventas siguen guardadas en este equipo.')
  })
})

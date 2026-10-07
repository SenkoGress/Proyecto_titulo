// src/lib/api/apiError.ts
import { isAxiosError } from 'axios'

// mensaje de error para mostrar
export function obtenerMensajeError(error: unknown): string {
  if (isAxiosError(error)) {
    // backend apagado o sin red
    if (!error.response) {
      return 'No se pudo conectar con el servidor de GesTock'
    }

    // el backend limita las peticiones por ip
    if (error.response.status === 429) {
      return 'El servidor recibio demasiadas peticiones seguidas. Espera un par de minutos y vuelve a intentar.'
    }

    // mensaje que manda el backend
    const data = error.response.data as { message?: string } | undefined
    return data?.message ?? `Error del servidor (${error.response.status})`
  }

  if (error instanceof Error) return error.message
  return 'Ocurrio un error inesperado'
}

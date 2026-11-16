// src/lib/query/queryClient.ts
import { QueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'

// cada cuanto se refrescan solas las pantallas que miran datos en vivo.
// el backend limita a 300 peticiones cada 15 min por ip, asi que no conviene bajarlo
export const INTERVALO_REFRESCO_MS = 60_000

// cuanto rato se da por buena una respuesta antes de volver a pedirla al cambiar de pantalla
export const VIGENCIA_CORTA_MS = 60_000
export const VIGENCIA_LARGA_MS = 5 * 60_000

// configuracion de react query
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // si el backend contesto (404, 429, 500) reintentar no sirve y gasta cupo
      retry: (intentos, error) => (isAxiosError(error) && error.response ? false : intentos < 1),
      staleTime: VIGENCIA_CORTA_MS,
      refetchOnWindowFocus: false,
    },
  },
})

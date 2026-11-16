// src/features/clima/hooks/useClima.ts
import { useQuery } from '@tanstack/react-query'
import { buscarLugar, obtenerClima } from '@/features/clima/api/clima.api'
import { useConfigDte } from '@/features/dte/hooks/useConfigDte'
import type { Lugar } from '@/features/clima/types'

// el clima no cambia de un minuto a otro
const VIGENCIA_CLIMA_MS = 30 * 60_000

// clima de hoy en la comuna del local, que viene de GET /dte/config
export function useClima() {
  const { data: configDte } = useConfigDte()
  const comuna = configDte?.emisor.comuna
  const ciudad = configDte?.emisor.ciudad

  const lugar = useQuery({
    queryKey: ['clima', 'lugar', comuna, ciudad],
    queryFn: () => buscarLugar(comuna as string, ciudad),
    enabled: Boolean(comuna),
    staleTime: Infinity, // el local no se cambia de comuna
  })

  return useQuery({
    queryKey: ['clima', 'actual', lugar.data?.latitud, lugar.data?.longitud],
    queryFn: () => obtenerClima(lugar.data as Lugar),
    enabled: Boolean(lugar.data),
    staleTime: VIGENCIA_CLIMA_MS,
    refetchInterval: VIGENCIA_CLIMA_MS,
  })
}

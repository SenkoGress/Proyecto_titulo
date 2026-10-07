// src/features/dashboard/hooks/useDashboard.ts
import { useQuery } from '@tanstack/react-query'
import { obtenerResumenDashboard, obtenerTendencias } from '@/features/dashboard/api/dashboard.api'
import { INTERVALO_REFRESCO_MS } from '@/lib/query/queryClient'
import type { PeriodoDashboard } from '@/features/dashboard/types'

// resumen analitico del periodo elegido
export function useResumenDashboard(periodo: PeriodoDashboard) {
  return useQuery({
    queryKey: ['dashboard', 'resumen', periodo],
    queryFn: () => obtenerResumenDashboard(periodo),
    refetchInterval: INTERVALO_REFRESCO_MS,
  })
}

// tendencias de mercado (cambian poco, no vale la pena refrescarlas seguido)
export function useTendencias() {
  return useQuery({
    queryKey: ['dashboard', 'tendencias'],
    queryFn: obtenerTendencias,
    staleTime: 5 * 60_000,
  })
}

// src/features/caja/pages/CierreCajaPage.tsx
import { useState } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Skeleton from '@mui/material/Skeleton'
import Typography from '@mui/material/Typography'
import { Migas } from '@/shared/components/ui/Migas'
import { ErrorBox } from '@/shared/components/ui/ErrorBox'
import { useResumenCaja } from '@/features/caja/hooks/useCaja'
import { EstadoSinTurno } from '@/features/caja/components/EstadoSinTurno'
import { EncabezadoTurno } from '@/features/caja/components/EncabezadoTurno'
import { BarraBalanceTurno } from '@/features/caja/components/BarraBalanceTurno'
import { KpisBalanceTurno } from '@/features/caja/components/KpisBalanceTurno'
import { DesgloseVentas } from '@/features/caja/components/DesgloseVentas'
import { Movimientos } from '@/features/caja/components/Movimientos'
import { ArqueoDenominaciones } from '@/features/caja/components/ArqueoDenominaciones'
import { PanelCuadratura } from '@/features/caja/components/PanelCuadratura'
import { BarraAccionesCierre } from '@/features/caja/components/BarraAccionesCierre'
import { HistorialCierres } from '@/features/caja/components/HistorialCierres'
import { DialogoCierreExitoso } from '@/features/caja/components/DialogoCierreExitoso'
import { DialogoReporteZ } from '@/features/caja/components/DialogoReporteZ'
import { useArqueoStore } from '@/features/caja/stores/arqueoStore'
import type { SesionCaja } from '@/features/caja/types'

// cierre de caja y arqueo ciego: mismo diseño para modo visual y tecnico
export function CierreCajaPage() {
  const resumen = useResumenCaja()
  const limpiarArqueo = useArqueoStore((estado) => estado.limpiar)

  const [turnoCerrado, setTurnoCerrado] = useState<SesionCaja | null>(null)
  const [viendoReporte, setViendoReporte] = useState(false)

  function alCerrarTurno(sesion: SesionCaja) {
    setTurnoCerrado(sesion)
    limpiarArqueo()
  }

  const sesion = resumen.data?.activa ? resumen.data.data : null

  return (
    <Box sx={{ height: '100%', overflowY: 'auto' }}>
      <Migas rutas={['Cierre de Caja', 'Arqueo y Cierre de Turno']} />

      {resumen.isPending && <Skeleton variant="rounded" height={300} />}
      {resumen.isError && <ErrorBox error={resumen.error} />}

      {resumen.data && !resumen.data.activa && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <EstadoSinTurno />
          <HistorialCierres />
        </Box>
      )}

      {sesion && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <EncabezadoTurno sesion={sesion} />

          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {/* izquierda: arqueo y movimientos */}
            <Box sx={{ width: 420, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  Arqueo y cierre de caja (Z)
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Cuenta el dinero real de la gaveta y verifica la cuadratura del turno.
                </Typography>
              </Box>

              <ArqueoDenominaciones />
              <PanelCuadratura sesion={sesion} />
              <BarraAccionesCierre onCerrado={alCerrarTurno} />
            </Box>

            {/* derecha: balance en vivo y detalle */}
            <Box sx={{ flex: '1 1 340px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Paper variant="outlined" sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <BarraBalanceTurno
                  sesion={sesion}
                  actualizando={resumen.isFetching}
                  onActualizar={() => resumen.refetch()}
                  onVerReporte={() => setViendoReporte(true)}
                />

                <KpisBalanceTurno sesion={sesion} />
              </Paper>

              <DesgloseVentas sesion={sesion} />

              <Movimientos movimientos={sesion.movimientos ?? []} />
            </Box>
          </Box>

          <HistorialCierres />
        </Box>
      )}

      <DialogoCierreExitoso sesion={turnoCerrado} onCerrar={() => setTurnoCerrado(null)} />
      {viendoReporte && sesion && <DialogoReporteZ sesion={sesion} onCerrar={() => setViendoReporte(false)} />}
    </Box>
  )
}

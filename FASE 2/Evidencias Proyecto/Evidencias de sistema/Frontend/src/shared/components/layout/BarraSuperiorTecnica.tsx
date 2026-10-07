// src/shared/components/layout/BarraSuperiorTecnica.tsx
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import Skeleton from '@mui/material/Skeleton'
import StorefrontIcon from '@mui/icons-material/Storefront'
import ScheduleIcon from '@mui/icons-material/Schedule'
import { useReloj } from '@/shared/hooks/useReloj'
import { useConfigDte } from '@/features/dte/hooks/useConfigDte'
import { useEstadoPos } from '@/features/pos/hooks/usePos'
import { BotonSincronizar } from '@/shared/components/layout/BotonSincronizar'

// color del punto por estado
const colorEstado = {
  ONLINE: '#16a34a',
  SYNC_PENDING: '#d97706',
  OFFLINE: '#dc2626',
} as const

// barra superior del modo tecnico
export function BarraSuperiorTecnica() {
  const ahora = useReloj()
  const { data: configDte, isPending: cargandoLocal } = useConfigDte()
  const { data: estado } = useEstadoPos()

  return (
    <Paper
      elevation={0}
      square
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        px: 2,
        py: 1.25,
        borderBottom: 1, borderBottomColor: 'divider',
      }}
    >
      {/* nombre del local (GET /dte/config) */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <StorefrontIcon color="primary" />
        {cargandoLocal ? (
          <Skeleton width={160} />
        ) : (
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {configDte?.emisor.razonSocial ?? 'Local sin configurar'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {configDte ? `${configDte.emisor.comuna}, ${configDte.emisor.ciudad}` : ''}
            </Typography>
          </Box>
        )}
      </Box>

      <Divider orientation="vertical" flexItem />

      {/* estado de la caja */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box
          sx={{
            width: 9,
            height: 9,
            borderRadius: '50%',
            bgcolor: estado ? colorEstado[estado.status] : colorEstado.OFFLINE,
          }}
        />
        <Typography variant="body2">{estado?.device_id ?? 'Terminal local'}</Typography>
      </Box>

      <Box sx={{ flexGrow: 1 }} />

      {/* los atajos de teclado los muestra cada pantalla, no esta barra:
          las teclas que sirven cambian segun donde estes parado */}

      {/* reloj */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <ScheduleIcon fontSize="small" color="action" />
        <Typography variant="h6" sx={{ fontWeight: 700, fontFamily: 'monospace' }}>
          {ahora.toLocaleTimeString('es-CL')}
        </Typography>
      </Box>

      <BotonSincronizar />
    </Paper>
  )
}

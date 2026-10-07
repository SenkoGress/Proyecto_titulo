// src/features/notificaciones/components/FilaNotificacion.tsx
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import { alpha, useTheme } from '@mui/material/styles'
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord'
import { haceCuanto } from '@/features/dashboard/utils/tiempoRelativo'
import { COLOR_SEVERIDAD, NOMBRE_CATEGORIA, NOMBRE_SEVERIDAD } from '@/features/notificaciones/utils/severidad'
import { ICONO_CATEGORIA } from '@/features/notificaciones/components/iconoCategoria'
import type { Notificacion } from '@/features/notificaciones/types'

type Props = {
  notificacion: Notificacion
  sinVer: boolean
  esModoTecnico: boolean
  onAccion: (notificacion: Notificacion) => void
}

export function FilaNotificacion({ notificacion, sinVer, esModoTecnico, onAccion }: Props) {
  const theme = useTheme()
  const color = COLOR_SEVERIDAD[notificacion.severidad]

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        display: 'flex',
        gap: 2,
        alignItems: 'flex-start',
        borderLeft: 4,
        borderLeftColor: `${color}.main`,
        bgcolor: sinVer ? alpha(theme.palette[color].main, 0.05) : 'background.paper',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          p: 1,
          borderRadius: 2,
          bgcolor: alpha(theme.palette[color].main, 0.12),
          color: `${color}.main`,
        }}
      >
        {ICONO_CATEGORIA[notificacion.categoria]}
      </Box>

      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          {sinVer && <FiberManualRecordIcon sx={{ fontSize: 10, color: `${color}.main` }} />}

          <Typography variant="body1" sx={{ fontWeight: 700 }}>
            {notificacion.titulo}
          </Typography>

          <Chip label={NOMBRE_SEVERIDAD[notificacion.severidad]} size="small" color={color} sx={{ fontWeight: 700 }} />

          <Chip label={NOMBRE_CATEGORIA[notificacion.categoria]} size="small" variant="outlined" />
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {notificacion.detalle}
        </Typography>

        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', mt: 0.5, flexWrap: 'wrap' }}>
          {notificacion.cuando && (
            <Typography variant="caption" color="text.secondary">
              {haceCuanto(notificacion.cuando)}
            </Typography>
          )}

          {/* de donde sale el dato, util para depurar */}
          {esModoTecnico && (
            <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.disabled' }}>
              {notificacion.origen}
            </Typography>
          )}
        </Box>
      </Box>

      {notificacion.textoAccion && (
        <Button size="small" variant="outlined" onClick={() => onAccion(notificacion)} sx={{ flexShrink: 0 }}>
          {notificacion.textoAccion}
        </Button>
      )}
    </Paper>
  )
}

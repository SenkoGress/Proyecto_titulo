// src/features/notificaciones/components/ResumenNotificaciones.tsx
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { alpha, useTheme } from '@mui/material/styles'
import { COLOR_SEVERIDAD, NOMBRE_SEVERIDAD, contarPorSeveridad } from '@/features/notificaciones/utils/severidad'
import type { Notificacion, SeveridadNotificacion } from '@/features/notificaciones/types'

type Props = {
  lista: Notificacion[]
}

const PIE: Record<SeveridadNotificacion, string> = {
  critica: 'Hay que resolverlo hoy',
  alta: 'Conviene resolverlo esta semana',
  media: 'Para tener presente',
  info: 'Solo informativo',
}

const ORDEN: SeveridadNotificacion[] = ['critica', 'alta', 'media', 'info']

// conteo por urgencia
export function ResumenNotificaciones({ lista }: Props) {
  const theme = useTheme()
  const conteo = contarPorSeveridad(lista)

  return (
    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' } }}>
      {ORDEN.map((severidad) => {
        const color = COLOR_SEVERIDAD[severidad]
        const cantidad = conteo[severidad]

        return (
          <Paper
            key={severidad}
            variant="outlined"
            sx={{
              p: 2,
              borderColor: cantidad > 0 ? alpha(theme.palette[color].main, 0.4) : 'divider',
            }}
          >
            <Typography
              variant="caption"
              sx={{ fontWeight: 700, letterSpacing: 0.5, color: cantidad > 0 ? `${color}.main` : 'text.secondary' }}
            >
              {NOMBRE_SEVERIDAD[severidad].toUpperCase()}
            </Typography>

            <Typography variant="h4" sx={{ fontWeight: 700, lineHeight: 1.2, my: 0.25 }}>
              {cantidad}
            </Typography>

            <Typography variant="caption" color="text.secondary">
              {PIE[severidad]}
            </Typography>
          </Paper>
        )
      })}
    </Box>
  )
}

// src/features/configuracion/components/Seccion.tsx
import type { ReactNode } from 'react'
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import Chip from '@mui/material/Chip'
import { alpha, useTheme } from '@mui/material/styles'

type Props = {
  titulo: string
  descripcion: string
  icono: ReactNode
  // donde se guarda: en el equipo o en el servidor
  origen: 'equipo' | 'servidor' | 'lectura'
  children: ReactNode
}

const ETIQUETA_ORIGEN = {
  equipo: { texto: 'Se guarda en este equipo', color: 'default' as const },
  servidor: { texto: 'Se guarda en el servidor', color: 'primary' as const },
  lectura: { texto: 'Solo lectura', color: 'default' as const },
}

// bloque de configuracion, para que todas las secciones se vean igual
export function Seccion({ titulo, descripcion, icono, origen, children }: Props) {
  const theme = useTheme()
  const etiqueta = ETIQUETA_ORIGEN[origen]

  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', mb: 1 }}>
        <Box
          sx={{
            display: 'flex',
            p: 1,
            borderRadius: 2,
            bgcolor: alpha(theme.palette.primary.main, 0.12),
            color: 'primary.main',
          }}
        >
          {icono}
        </Box>

        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {titulo}
            </Typography>
            <Chip label={etiqueta.texto} size="small" color={etiqueta.color} variant="outlined" />
          </Box>

          <Typography variant="body2" color="text.secondary">
            {descripcion}
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ my: 2 }} />

      {children}
    </Paper>
  )
}

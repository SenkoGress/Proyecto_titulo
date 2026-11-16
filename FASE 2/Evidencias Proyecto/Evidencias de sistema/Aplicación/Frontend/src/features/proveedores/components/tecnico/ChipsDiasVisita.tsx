// src/features/proveedores/components/tecnico/ChipsDiasVisita.tsx
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'
import { alpha, useTheme } from '@mui/material/styles'
import { diaDeHoy, DIAS_SEMANA, diasActivos } from '@/features/proveedores/utils/diasVisita'

type Props = {
  diasVisita: string
}

// semana en chips: se marcan los dias que aparecen en el texto del proveedor
export function ChipsDiasVisita({ diasVisita }: Props) {
  const theme = useTheme()
  const activos = diasActivos(diasVisita)
  const hoy = diaDeHoy()

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 0.5 }}>
        {DIAS_SEMANA.map((dia) => {
          const activo = activos.has(dia.indice)
          const esHoy = dia.indice === hoy

          return (
            <Box
              key={dia.sigla}
              sx={{
                px: 0.75,
                py: 0.25,
                borderRadius: 1,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 0.3,
                bgcolor: activo ? alpha(theme.palette.primary.main, 0.12) : 'transparent',
                color: activo ? 'primary.main' : 'text.disabled',
                border: '1px solid',
                borderColor: esHoy ? 'primary.main' : 'transparent',
              }}
            >
              {dia.sigla}
            </Box>
          )
        })}
      </Box>

      {activos.size === 0 && (
        <Tooltip title={`El backend no reconocio ningun dia en el texto "${diasVisita}"`}>
          <Typography variant="caption" color="text.secondary">
            Sin dia reconocido
          </Typography>
        </Tooltip>
      )}
    </Box>
  )
}

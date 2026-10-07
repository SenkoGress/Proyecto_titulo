// src/features/caja/components/PanelCuadratura.tsx
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import { alpha } from '@mui/material/styles'
import VisibilityIcon from '@mui/icons-material/Visibility'
import { formatoClp } from '@/shared/utils/formatoClp'
import { useArqueoStore, useTotalContado } from '@/features/caja/stores/arqueoStore'
import type { SesionCaja } from '@/features/caja/types'

type Props = {
  sesion: SesionCaja
}

// arqueo ciego: no se muestra hasta que lo pidan
export function PanelCuadratura({ sesion }: Props) {
  const revelada = useArqueoStore((estado) => estado.cuadraturaRevelada)
  const revelarCuadratura = useArqueoStore((estado) => estado.revelarCuadratura)
  const totalContado = useTotalContado()

  if (!revelada) {
    return (
      <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
        <Button variant="outlined" startIcon={<VisibilityIcon />} onClick={revelarCuadratura}>
          Comparar con el sistema
        </Button>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          El monto esperado por el sistema se muestra recien aqui, para no influir el conteo.
        </Typography>
      </Paper>
    )
  }

  const diferencia = totalContado - sesion.monto_esperado_efectivo
  const cuadra = diferencia === 0

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        borderColor: cuadra ? 'success.main' : 'warning.main',
        bgcolor: (theme) => alpha(cuadra ? theme.palette.success.main : theme.palette.warning.main, 0.12),
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          {cuadra ? 'Cuadratura exacta' : diferencia > 0 ? 'Sobrante en gaveta' : 'Faltante en gaveta'}
        </Typography>
        <Chip
          size="small"
          color={cuadra ? 'success' : 'warning'}
          label={cuadra ? '100% cuadrada' : formatoClp(Math.abs(diferencia))}
        />
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Typography variant="body2" color="text.secondary">
          Esperado por el sistema
        </Typography>
        <Typography variant="body2">{formatoClp(sesion.monto_esperado_efectivo)}</Typography>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Typography variant="body2" color="text.secondary">
          Contado en gaveta
        </Typography>
        <Typography variant="body2">{formatoClp(totalContado)}</Typography>
      </Box>
    </Paper>
  )
}

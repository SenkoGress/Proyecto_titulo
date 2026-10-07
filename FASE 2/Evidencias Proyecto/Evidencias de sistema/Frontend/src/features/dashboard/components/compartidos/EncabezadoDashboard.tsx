// src/features/dashboard/components/compartidos/EncabezadoDashboard.tsx
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import Tooltip from '@mui/material/Tooltip'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import CircularProgress from '@mui/material/CircularProgress'
import RefreshOutlined from '@mui/icons-material/RefreshOutlined'
import { PERIODOS, nombrePeriodo } from '@/features/dashboard/utils/periodos'
import type { PeriodoDashboard } from '@/features/dashboard/types'

type Props = {
  titulo: string
  descripcion: string
  periodo: PeriodoDashboard
  actualizando: boolean
  onCambiarPeriodo: (periodo: PeriodoDashboard) => void
  onActualizar: () => void
}

// titulo, periodo y refresco del panel
export function EncabezadoDashboard({
  titulo,
  descripcion,
  periodo,
  actualizando,
  onCambiarPeriodo,
  onActualizar,
}: Props) {
  return (
    <Paper
      variant="outlined"
      sx={{ p: 2, display: 'flex', gap: 2, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {titulo}
          </Typography>
          <Chip label={nombrePeriodo(periodo)} size="small" color="primary" variant="outlined" sx={{ fontWeight: 700 }} />

          {periodo === 'diario' && (
            <Tooltip title="El backend corta el dia a medianoche UTC, que en Chile son las 21:00. Despues de esa hora las ventas pasan a contarse como del dia siguiente.">
              <Chip label="El dia corta a las 21:00" size="small" color="warning" variant="outlined" />
            </Tooltip>
          )}
        </Box>

        <Typography variant="body2" color="text.secondary">
          {descripcion}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
        <ToggleButtonGroup
          value={periodo}
          exclusive
          size="small"
          onChange={(_, valor) => valor && onCambiarPeriodo(valor)}
        >
          {PERIODOS.map((item) => (
            <ToggleButton key={item.valor} value={item.valor}>
              {item.etiqueta}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        <Button
          size="small"
          variant="outlined"
          startIcon={actualizando ? <CircularProgress size={16} /> : <RefreshOutlined />}
          onClick={onActualizar}
          disabled={actualizando}
        >
          Actualizar
        </Button>
      </Box>
    </Paper>
  )
}

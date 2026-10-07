// src/features/caja/components/BarraBalanceTurno.tsx
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import RefreshOutlined from '@mui/icons-material/RefreshOutlined'
import PrintOutlined from '@mui/icons-material/PrintOutlined'
import { formatFecha } from '@/shared/utils/formatFecha'
import { useTiempoTranscurrido } from '@/features/caja/hooks/useTiempoTranscurrido'
import type { SesionCaja } from '@/features/caja/types'

type Props = {
  sesion: SesionCaja
  actualizando: boolean
  onActualizar: () => void
  onVerReporte: () => void
}

// encabezado del balance: estado del turno y acciones
export function BarraBalanceTurno({ sesion, actualizando, onActualizar, onVerReporte }: Props) {
  const tiempo = useTiempoTranscurrido(sesion.fecha_apertura)

  return (
    <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap' }}>
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Balance en vivo del turno
        </Typography>

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', mt: 0.5 }}>
          <Chip
            size="small"
            color="success"
            label={`CAJA ${sesion.estado}`}
            sx={{ fontWeight: 700 }}
          />
          <Typography variant="caption" color="text.secondary">
            Desde {formatFecha(sesion.fecha_apertura)} · {tiempo} · {sesion.cajero_nombre ?? 'sin cajero'} ·{' '}
            {sesion.transacciones_count ?? 0} documentos
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Button
          size="small"
          variant="outlined"
          startIcon={actualizando ? <CircularProgress size={16} /> : <RefreshOutlined />}
          onClick={onActualizar}
          disabled={actualizando}
        >
          Actualizar
        </Button>

        <Button size="small" variant="contained" startIcon={<PrintOutlined />} onClick={onVerReporte}>
          Imprimir reporte Z
        </Button>
      </Box>
    </Box>
  )
}

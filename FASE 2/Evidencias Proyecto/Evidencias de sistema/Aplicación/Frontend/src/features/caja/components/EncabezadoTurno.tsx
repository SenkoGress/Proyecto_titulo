// src/features/caja/components/EncabezadoTurno.tsx
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import { useEstadoPos } from '@/features/pos/hooks/usePos'
import type { SesionCaja } from '@/features/caja/types'

type Props = {
  sesion: SesionCaja
}

// titulo de la pantalla + aviso de que el arqueo es ciego
export function EncabezadoTurno({ sesion }: Props) {
  const { data: estadoPos } = useEstadoPos()

  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <Typography variant="h1">Cierre de Caja y Arqueo Ciego</Typography>
        <Chip
          size="small"
          color="success"
          label={`TURNO ${sesion.estado} · ${estadoPos?.device_id ?? 'POS-LOCAL'}`}
        />
      </Box>

      <Alert severity="info" icon={<VisibilityOffIcon />} sx={{ mt: 1 }}>
        Modo ciego habilitado: cuenta el efectivo de la gaveta sin ver el monto que el sistema
        espera. La comparacion aparece recien cuando termines de contar.
      </Alert>
    </Box>
  )
}

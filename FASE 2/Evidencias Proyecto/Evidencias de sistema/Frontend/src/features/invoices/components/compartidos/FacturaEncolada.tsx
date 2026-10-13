// src/features/invoices/components/compartidos/FacturaEncolada.tsx
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'
import ScheduleOutlined from '@mui/icons-material/ScheduleOutlined'
import ReportProblemOutlined from '@mui/icons-material/ReportProblemOutlined'
import type { FacturaEnCola } from '@/features/invoices/types'

type Props = {
  cola: FacturaEnCola
  mensaje: string
  onSubirOtra: () => void
}

// la factura no se pudo leer y quedo guardada esperando
export function FacturaEncolada({ cola, mensaje, onSubirOtra }: Props) {
  const seRindio = cola.estado === 'FALLIDA_OCR'

  return (
    <Box sx={{ maxWidth: 640, mx: 'auto', mt: 4 }}>
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', mb: 2 }}>
          {seRindio ? (
            <ReportProblemOutlined color="error" />
          ) : (
            <ScheduleOutlined color="info" />
          )}

          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {seRindio ? 'No se pudo leer la factura' : 'La factura quedo guardada'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {cola.archivo_nombre}
            </Typography>
          </Box>

          <Chip
            label={cola.numero_factura}
            size="small"
            variant="outlined"
            sx={{ fontFamily: 'monospace', flexShrink: 0 }}
          />
        </Box>

        <Alert severity={seRindio ? 'error' : 'info'} sx={{ mb: 2 }}>
          {seRindio
            ? `Se intento ${cola.intentos_maximos} veces y no se logro. Hay que ingresarla a mano.`
            : mensaje}
        </Alert>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          El archivo no se perdio: quedo guardado con el codigo {cola.numero_factura}, que sirve para
          encontrarlo despues.
        </Typography>

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button variant="contained" onClick={onSubirOtra}>
            Subir otra factura
          </Button>
        </Box>
      </Paper>
    </Box>
  )
}

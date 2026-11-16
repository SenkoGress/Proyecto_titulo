// src/features/caja/components/DialogoReporteZ.tsx
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import PrintOutlined from '@mui/icons-material/PrintOutlined'
import { ReporteZResumen } from '@/features/caja/components/ReporteZResumen'
import { imprimirReporteZ } from '@/features/caja/utils/imprimirReporteZ'
import type { SesionCaja } from '@/features/caja/types'

type Props = {
  sesion: SesionCaja
  onCerrar: () => void
}

// vista previa del reporte del turno, con el turno todavia abierto
export function DialogoReporteZ({ sesion, onCerrar }: Props) {
  return (
    <Dialog open onClose={onCerrar} maxWidth="xs" fullWidth>
      <DialogTitle>Reporte del turno</DialogTitle>

      <DialogContent dividers>
        {sesion.estado === 'ABIERTA' && (
          <Alert severity="info" sx={{ mb: 2 }}>
            El turno sigue abierto: estos montos son los del momento y pueden cambiar.
          </Alert>
        )}

        <ReporteZResumen sesion={sesion} />
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onCerrar}>Cerrar</Button>
        <Button variant="contained" startIcon={<PrintOutlined />} onClick={imprimirReporteZ}>
          Imprimir
        </Button>
      </DialogActions>
    </Dialog>
  )
}

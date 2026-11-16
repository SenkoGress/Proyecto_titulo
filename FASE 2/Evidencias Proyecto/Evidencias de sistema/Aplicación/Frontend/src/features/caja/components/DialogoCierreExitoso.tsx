// src/features/caja/components/DialogoCierreExitoso.tsx
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import PrintOutlined from '@mui/icons-material/PrintOutlined'
import { imprimirReporteZ } from '@/features/caja/utils/imprimirReporteZ'
import { ReporteZResumen } from '@/features/caja/components/ReporteZResumen'
import type { SesionCaja } from '@/features/caja/types'

type Props = {
  sesion: SesionCaja | null
  onCerrar: () => void
}

// turno cerrado: comprobante interno con el resumen real del cierre
export function DialogoCierreExitoso({ sesion, onCerrar }: Props) {
  return (
    <Dialog open={sesion !== null} onClose={onCerrar} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <CheckCircleIcon color="success" />
        Turno cerrado
      </DialogTitle>

      <DialogContent>{sesion && <ReporteZResumen sesion={sesion} />}</DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button startIcon={<PrintOutlined />} onClick={imprimirReporteZ}>
          Imprimir reporte Z
        </Button>
        <Button variant="contained" onClick={onCerrar} autoFocus>
          Aceptar
        </Button>
      </DialogActions>
    </Dialog>
  )
}

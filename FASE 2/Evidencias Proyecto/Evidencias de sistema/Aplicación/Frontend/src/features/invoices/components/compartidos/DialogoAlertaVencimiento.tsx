// src/features/invoices/components/compartidos/DialogoAlertaVencimiento.tsx
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import WarningAmberOutlined from '@mui/icons-material/WarningAmberOutlined'
import { formatFechaSola } from '@/shared/utils/formatFecha'
import type { AvisoVencimiento } from '@/features/invoices/types'

// cuantos dias le quedan, o hace cuantos vencio
function plazo(dias: number): string {
  if (dias < 0) return `vencio hace ${-dias} dia${dias === -1 ? '' : 's'}`
  if (dias === 0) return 'vence hoy'
  return `vence en ${dias} dia${dias === 1 ? '' : 's'}`
}

// los productos de un aviso, con su fecha y su plazo
export function ListaAvisosVencimiento({ avisos }: { avisos: AvisoVencimiento[] }) {
  return (
    <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
      {avisos.map((aviso, indice) => (
        <Typography component="li" variant="body2" key={`${aviso.descripcion}-${indice}`}>
          <strong>{aviso.descripcion}</strong> · {formatFechaSola(aviso.fecha_vencimiento)} ·{' '}
          {plazo(aviso.dias_restantes)} · {aviso.cantidad} un.
        </Typography>
      ))}
    </Box>
  )
}

type Props = {
  vencidos: AvisoVencimiento[]
  onVolver: () => void
  onIngresar: () => void
}

// antes de ingresar: la factura trae productos con la fecha ya cumplida
export function DialogoAlertaVencimiento({ vencidos, onVolver, onIngresar }: Props) {
  return (
    <Dialog open onClose={onVolver} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <WarningAmberOutlined color="error" />
        {vencidos.length === 1 ? 'Hay un producto vencido' : `Hay ${vencidos.length} productos vencidos`}
      </DialogTitle>

      <DialogContent dividers>
        <Typography variant="body2" sx={{ mb: 1.5 }}>
          La fecha de vencimiento que ingresaste ya paso. Revisa que la fecha este bien escrita antes de continuar:
        </Typography>

        <ListaAvisosVencimiento avisos={vencidos} />

        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          El Reglamento Sanitario de los Alimentos (D.S. N° 977/96, MINSAL) no permite tener a la venta un producto
          vencido. Si los ingresas, quedan marcados en la alerta sanitaria del inventario para que los retires.
        </Typography>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button variant="contained" onClick={onVolver} autoFocus>
          Volver a revisar
        </Button>
        <Button color="error" onClick={onIngresar}>
          Ingresar de todos modos
        </Button>
      </DialogActions>
    </Dialog>
  )
}

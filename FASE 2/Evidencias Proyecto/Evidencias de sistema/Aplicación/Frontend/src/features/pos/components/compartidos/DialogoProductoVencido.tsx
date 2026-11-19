// src/features/pos/components/compartidos/DialogoProductoVencido.tsx
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import WarningAmberOutlined from '@mui/icons-material/WarningAmberOutlined'
import { formatFechaSola } from '@/shared/utils/formatFecha'
import { diasParaVencer } from '@/features/invoices/utils/vencimientoFactura'
import { useCarritoStore } from '@/features/pos/stores/carritoStore'

// el producto que se quiso agregar a la venta esta vencido: el cajero decide
export function DialogoProductoVencido() {
  const producto = useCarritoStore((estado) => estado.porConfirmarVencido)
  const confirmar = useCarritoStore((estado) => estado.confirmarVencido)
  const descartar = useCarritoStore((estado) => estado.descartarVencido)

  if (!producto?.fecha_vencimiento) return null

  const fecha = producto.fecha_vencimiento.slice(0, 10)
  const dias = -diasParaVencer(fecha, new Date())

  // ningun boton toma el foco: el Enter del lector de codigos no debe responder por el cajero.
  // un toque fuera del aviso no lo cierra: en una caja tactil, el doble toque lo descartaria sin leerlo
  return (
    <Dialog
      open
      onClose={(_evento, motivo) => {
        if (motivo !== 'backdropClick') descartar()
      }}
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <WarningAmberOutlined color="error" />
        Producto vencido
      </DialogTitle>

      <DialogContent dividers>
        <Typography variant="body1" sx={{ fontWeight: 600 }}>
          {producto.nombre}
        </Typography>
        <Typography variant="body2" sx={{ mb: 1.5 }}>
          Vencio el {formatFechaSola(fecha)}, hace {dias} dia{dias === 1 ? '' : 's'}.
        </Typography>

        <Typography variant="body2" color="text.secondary">
          El Reglamento Sanitario de los Alimentos (D.S. N° 977/96, MINSAL) no permite vender un producto vencido.
          Retiralo de la venta y avisa al encargado para registrarlo como merma.
        </Typography>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button variant="contained" onClick={descartar}>
          No vender
        </Button>
        <Button color="error" onClick={confirmar}>
          Vender de todos modos
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// src/features/inventario/components/DialogoSugerenciaPedido.tsx
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import type { ProductoBajoStock } from '@/features/replenishment/types'

type Props = {
  abierto: boolean
  onCerrar: () => void
  productos: ProductoBajoStock[]
}

// detalle de los productos que el algoritmo rop marco como criticos
export function DialogoSugerenciaPedido({ abierto, onCerrar, productos }: Props) {
  return (
    <Dialog open={abierto} onClose={onCerrar} maxWidth="sm" fullWidth>
      <DialogTitle>Sugerencia de pedido (punto de reorden)</DialogTitle>

      <DialogContent dividers>
        {productos.length === 0 && (
          <Typography color="text.secondary">No hay productos criticos en este momento.</Typography>
        )}

        <List dense>
          {productos.map((producto) => (
            <ListItem key={producto.producto_id} sx={{ px: 0 }}>
              <ListItemText
                primary={producto.nombre}
                secondary={
                  <>
                    Stock {producto.stock_actual}/{producto.stock_minimo} ·{' '}
                    {producto.dias_inventario_restante} dias de cobertura ·{' '}
                    {producto.proveedor_nombre ?? 'Sin proveedor'}
                    {producto.proxima_visita.displayText ? ` · ${producto.proxima_visita.displayText}` : ''}
                  </>
                }
              />
              {producto.is_agotado && <Chip size="small" color="error" label="Agotado" />}
            </ListItem>
          ))}
        </List>

        <Typography variant="caption" color="text.secondary">
          Calculado en vivo por GET /replenishment/suggest (velocidad de venta, lead time y stock de
          seguridad del proveedor).
        </Typography>
      </DialogContent>

      <DialogActions>
        <Button onClick={onCerrar}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  )
}

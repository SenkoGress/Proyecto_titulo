// src/features/pos/components/visual/LineaTicket.tsx
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { EtiquetasProducto } from '@/features/pos/components/compartidos/EtiquetasProducto'
import IconButton from '@mui/material/IconButton'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import { formatoClp } from '@/shared/utils/formatoClp'
import { useCarritoStore, type LineaCarrito } from '@/features/pos/stores/carritoStore'

type Props = {
  linea: LineaCarrito
}

// fila del ticket
export function LineaTicket({ linea }: Props) {
  const agregar = useCarritoStore((estado) => estado.agregar)
  const quitarUno = useCarritoStore((estado) => estado.quitarUno)
  const eliminarLinea = useCarritoStore((estado) => estado.eliminarLinea)

  const subtotal = linea.producto.precio_venta * linea.cantidad
  const alcanzoElStock = linea.cantidad >= linea.producto.stock_actual

  return (
    <Box sx={{ py: 1.25, borderBottom: 1, borderBottomColor: 'divider' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {linea.producto.nombre}
          </Typography>
          <EtiquetasProducto producto={linea.producto} soloPrincipal />
        </Box>
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          {formatoClp(subtotal)}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.5 }}>
        <Typography variant="caption" color="text.secondary">
          {formatoClp(linea.producto.precio_venta)} c/u
        </Typography>

        {/* cantidad y borrar */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <IconButton size="small" onClick={() => quitarUno(linea.producto.id)}>
            <RemoveIcon fontSize="small" />
          </IconButton>

          <Typography sx={{ minWidth: 24, textAlign: 'center', fontWeight: 600 }}>
            {linea.cantidad}
          </Typography>

          <IconButton size="small" disabled={alcanzoElStock} onClick={() => agregar(linea.producto)}>
            <AddIcon fontSize="small" />
          </IconButton>

          <IconButton size="small" color="error" onClick={() => eliminarLinea(linea.producto.id)}>
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>
    </Box>
  )
}

// src/features/invoices/components/tecnico/FilaConciliacionTecnica.tsx
import Box from '@mui/material/Box'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import IconButton from '@mui/material/IconButton'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlineOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import { formatoClp } from '@/shared/utils/formatoClp'
import type { ItemFactura } from '@/features/invoices/types'

type Props = {
  item: ItemFactura
  onCambiar: (cambios: Partial<ItemFactura>) => void
  onEliminar: () => void
}

// mono para que las columnas de numeros calcen en vertical
const mono = { fontFamily: 'monospace', fontSize: 13 }

// fila densa: sku, descripcion, cantidad, costo y estado de mapeo con el catalogo
export function FilaConciliacionTecnica({ item, onCambiar, onEliminar }: Props) {
  return (
    <TableRow>
      {/* mapeado (existe en el catalogo) o nuevo */}
      <TableCell align="center" padding="checkbox">
        {item.es_nuevo ? (
          <Tooltip title="Producto nuevo, se creara en el catalogo">
            <ErrorOutlineIcon fontSize="small" color="warning" />
          </Tooltip>
        ) : (
          <Tooltip title="Ya existe en el catalogo">
            <CheckCircleIcon fontSize="small" color="success" />
          </Tooltip>
        )}
      </TableCell>

      <TableCell>
        <TextField
          value={item.sku}
          size="small"
          variant="standard"
          onChange={(evento) => onCambiar({ sku: evento.target.value })}
          slotProps={{ htmlInput: { style: mono } }}
        />
      </TableCell>

      <TableCell>
        <TextField
          value={item.descripcion}
          size="small"
          variant="standard"
          fullWidth
          onChange={(evento) => onCambiar({ descripcion: evento.target.value })}
        />
      </TableCell>

      <TableCell align="right">
        <TextField
          value={item.cantidad}
          size="small"
          variant="standard"
          onChange={(evento) => onCambiar({ cantidad: Number(evento.target.value) || 0 })}
          slotProps={{ htmlInput: { inputMode: 'decimal', style: { ...mono, textAlign: 'right', width: 56 } } }}
        />
      </TableCell>

      <TableCell align="right">
        <TextField
          value={item.precio_unitario}
          size="small"
          variant="standard"
          onChange={(evento) => onCambiar({ precio_unitario: Number(evento.target.value) || 0 })}
          slotProps={{ htmlInput: { inputMode: 'decimal', style: { ...mono, textAlign: 'right', width: 80 } } }}
        />
      </TableCell>

      {/* no hay costo anterior en la respuesta del backend, por eso no se puede comparar */}
      <TableCell align="right">
        <Tooltip title="El backend no devuelve el costo de la ultima compra en este paso">
          <Box component="span" sx={{ ...mono, color: 'text.disabled' }}>—</Box>
        </Tooltip>
      </TableCell>

      <TableCell align="right" sx={mono}>
        {formatoClp(item.precio_venta_sugerido)}
      </TableCell>

      <TableCell align="right" sx={{ ...mono, fontWeight: 700 }}>
        {formatoClp(item.subtotal)}
      </TableCell>

      <TableCell align="right" sx={mono}>
        {item.stock_actual} → {item.stock_proyectado}
      </TableCell>

      <TableCell align="center" padding="checkbox">
        <IconButton size="small" color="error" onClick={onEliminar}>
          <DeleteOutlineIcon fontSize="small" />
        </IconButton>
      </TableCell>
    </TableRow>
  )
}

// src/features/invoices/components/FilaItemFactura.tsx
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import TextField from '@mui/material/TextField'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import { formatoClp } from '@/shared/utils/formatoClp'
import type { ItemFactura } from '@/features/invoices/types'

type Props = {
  item: ItemFactura
  onCambiar: (cambios: Partial<ItemFactura>) => void
  onEliminar: () => void
}

// una linea editable de la factura
export function FilaItemFactura({ item, onCambiar, onEliminar }: Props) {
  return (
    <TableRow>
      {/* sku / codigo */}
      <TableCell>
        <TextField
          value={item.sku}
          size="small"
          variant="standard"
          onChange={(evento) => onCambiar({ sku: evento.target.value })}
          slotProps={{ htmlInput: { style: { fontFamily: 'monospace', fontSize: 13 } } }}
        />
      </TableCell>

      {/* descripcion */}
      <TableCell>
        <TextField
          value={item.descripcion}
          size="small"
          variant="standard"
          fullWidth
          onChange={(evento) => onCambiar({ descripcion: evento.target.value })}
        />
      </TableCell>

      {/* cantidad */}
      <TableCell align="center">
        <TextField
          value={item.cantidad}
          size="small"
          variant="standard"
          onChange={(evento) => onCambiar({ cantidad: Number(evento.target.value) || 0 })}
          slotProps={{
            htmlInput: { inputMode: 'decimal', style: { textAlign: 'center', width: 56 } },
          }}
        />
      </TableCell>

      {/* costo neto unitario */}
      <TableCell align="right">
        <TextField
          value={item.precio_unitario}
          size="small"
          variant="standard"
          onChange={(evento) => onCambiar({ precio_unitario: Number(evento.target.value) || 0 })}
          slotProps={{
            htmlInput: { inputMode: 'decimal', style: { textAlign: 'right', width: 80 } },
          }}
        />
      </TableCell>

      {/* precio de venta que va a quedar en el catalogo */}
      <TableCell align="right">
        <Tooltip title="Se calcula con el margen configurado en Configuracion > Margenes">
          <span>{formatoClp(item.precio_venta_sugerido)}</span>
        </Tooltip>
      </TableCell>

      <TableCell align="right" sx={{ fontWeight: 700 }}>
        {formatoClp(item.subtotal)}
      </TableCell>

      {/* nuevo en el catalogo o ya existia */}
      <TableCell align="center">
        <Chip
          size="small"
          label={item.es_nuevo ? 'Nuevo' : `Stock ${item.stock_actual} → ${item.stock_proyectado}`}
          color={item.es_nuevo ? 'info' : 'success'}
          variant={item.es_nuevo ? 'filled' : 'outlined'}
        />
      </TableCell>

      <TableCell align="center" padding="checkbox">
        <IconButton size="small" color="error" onClick={onEliminar}>
          <DeleteOutlineIcon fontSize="small" />
        </IconButton>
      </TableCell>
    </TableRow>
  )
}

// src/features/invoices/components/TablaItemsFactura.tsx
import Paper from '@mui/material/Paper'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableBody from '@mui/material/TableBody'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutlined'
import { FilaItemFactura } from '@/features/invoices/components/visual/FilaItemFactura'
import type { ItemFactura } from '@/features/invoices/types'

type Props = {
  items: ItemFactura[]
  onCambiarFila: (indice: number, cambios: Partial<ItemFactura>) => void
  onEliminarFila: (indice: number) => void
  onAgregarFila: () => void
}

// tabla de productos detectados, editable antes de confirmar
export function TablaItemsFactura({ items, onCambiarFila, onEliminarFila, onAgregarFila }: Props) {
  return (
    <Paper variant="outlined">
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>SKU / Codigo</TableCell>
              <TableCell>Producto</TableCell>
              <TableCell align="center">Cant.</TableCell>
              <TableCell align="right">Costo neto</TableCell>
              <TableCell align="right">P. venta sug.</TableCell>
              <TableCell align="right">Subtotal</TableCell>
              <TableCell align="center">Estado</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>

          <TableBody>
            {items.map((item, indice) => (
              <FilaItemFactura
                key={indice}
                item={item}
                onCambiar={(cambios) => onCambiarFila(indice, cambios)}
                onEliminar={() => onEliminarFila(indice)}
              />
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* por si el ocr se salto una linea de la factura */}
      <Box sx={{ p: 1 }}>
        <Button size="small" startIcon={<AddCircleOutlineIcon />} onClick={onAgregarFila}>
          Añadir producto manual
        </Button>
      </Box>
    </Paper>
  )
}

// src/features/invoices/components/tecnico/TablaConciliacionTecnica.tsx
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableBody from '@mui/material/TableBody'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutlined'
import { FilaConciliacionTecnica } from '@/features/invoices/components/tecnico/FilaConciliacionTecnica'
import { calcularResumenFactura } from '@/features/invoices/utils/calculosFactura'
import type { ItemFactura } from '@/features/invoices/types'

type Props = {
  items: ItemFactura[]
  totalDeclarado: number
  onCambiarFila: (indice: number, cambios: Partial<ItemFactura>) => void
  onEliminarFila: (indice: number) => void
  onAgregarFila: () => void
}

// tabla densa de conciliacion: producto extraido vs catalogo local
export function TablaConciliacionTecnica({ items, totalDeclarado, onCambiarFila, onEliminarFila, onAgregarFila }: Props) {
  const resumen = calcularResumenFactura(items, totalDeclarado)

  return (
    <Paper variant="outlined">
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1,
          borderBottom: 1, borderBottomColor: 'divider',
        }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          Conciliacion con catalogo
        </Typography>
        <Chip
          size="small"
          label={`${resumen.mapeados}/${resumen.itemsCount} mapeados`}
          color={resumen.mapeados === resumen.itemsCount ? 'success' : 'warning'}
        />
      </Box>

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell />
              <TableCell>SKU</TableCell>
              <TableCell>Producto</TableCell>
              <TableCell align="right">Cant.</TableCell>
              <TableCell align="right">Costo nuevo</TableCell>
              <TableCell align="right">Costo anterior</TableCell>
              <TableCell align="right">P. venta</TableCell>
              <TableCell align="right">Subtotal</TableCell>
              <TableCell align="right">Stock</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>

          <TableBody>
            {items.map((item, indice) => (
              <FilaConciliacionTecnica
                key={indice}
                item={item}
                onCambiar={(cambios) => onCambiarFila(indice, cambios)}
                onEliminar={() => onEliminarFila(indice)}
              />
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ p: 1 }}>
        <Button size="small" startIcon={<AddCircleOutlineIcon />} onClick={onAgregarFila}>
          Añadir producto manual
        </Button>
      </Box>
    </Paper>
  )
}

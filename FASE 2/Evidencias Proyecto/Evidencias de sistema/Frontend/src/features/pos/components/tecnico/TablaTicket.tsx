// src/features/pos/components/tecnico/TablaTicket.tsx
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
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import { alpha } from '@mui/material/styles'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import ListAltIcon from '@mui/icons-material/ListAlt'
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined'
import { formatoClp } from '@/shared/utils/formatoClp'
import { useCarritoStore, type LineaCarrito } from '@/features/pos/stores/carritoStore'
import { useTotalesCarrito } from '@/features/pos/hooks/useTotalesCarrito'
import { CampoCantidad } from '@/features/pos/components/tecnico/CampoCantidad'

// texto monoespaciado para codigos y montos
const mono = { fontFamily: 'monospace' }

// fila de la tabla
function FilaTicket({ linea }: { linea: LineaCarrito }) {
  const eliminarLinea = useCarritoStore((estado) => estado.eliminarLinea)
  const { producto } = linea

  const tasaIla = Number(producto.impuesto_adicional_tasa) || 0
  const stockBajo = producto.stock_actual <= producto.stock_minimo

  return (
    <TableRow sx={{ bgcolor: stockBajo ? (theme) => alpha(theme.palette.error.main, 0.1) : undefined }}>
      {/* codigo */}
      <TableCell>
        <Typography variant="body2" sx={{ ...mono, color: 'text.secondary' }}>
          {producto.codigo_barra ?? '-'}
        </Typography>
        <Typography variant="caption" sx={{ ...mono, color: 'text.disabled' }}>
          {producto.sku}
        </Typography>
      </TableCell>

      {/* descripcion y etiquetas */}
      <TableCell>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {producto.nombre}
          </Typography>

          {tasaIla > 0 && (
            <Chip size="small" label={`ILA ${tasaIla}%`} sx={{ ...mono, bgcolor: (theme) => alpha(theme.palette.info.main, 0.16) }} />
          )}

          {stockBajo && (
            <Tooltip title={`Stock bajo el minimo (${producto.stock_minimo})`}>
              <WarningAmberIcon fontSize="small" color="error" />
            </Tooltip>
          )}
        </Box>
      </TableCell>

      {/* stock */}
      <TableCell align="center">
        <Chip
          size="small"
          label={stockBajo ? `${producto.stock_actual} un - Bajo` : `${producto.stock_actual} un`}
          color={stockBajo ? 'error' : 'success'}
          variant={stockBajo ? 'outlined' : 'filled'}
          sx={{ fontWeight: 700 }}
        />
      </TableCell>

      {/* cantidad */}
      <TableCell align="center">
        <CampoCantidad linea={linea} />
      </TableCell>

      <TableCell align="right" sx={mono}>
        {formatoClp(producto.precio_venta)}
      </TableCell>

      <TableCell align="right" sx={{ ...mono, fontWeight: 700 }}>
        {formatoClp(producto.precio_venta * linea.cantidad)}
      </TableCell>

      {/* quitar */}
      <TableCell align="center" padding="checkbox">
        <IconButton size="small" color="error" onClick={() => eliminarLinea(producto.id)}>
          <DeleteOutlineIcon fontSize="small" />
        </IconButton>
      </TableCell>
    </TableRow>
  )
}

// tabla del ticket
export function TablaTicket() {
  const lineas = useCarritoStore((estado) => estado.lineas)
  const { cantidadLineas, unidades } = useTotalesCarrito()

  return (
    <Paper
      elevation={0}
      sx={{
        flexGrow: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        border: 1, borderColor: 'divider',
        borderRadius: 2,
        overflow: 'hidden',
      }}
    >
      <TableContainer sx={{ flexGrow: 1 }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell>SKU / CODIGO</TableCell>
              <TableCell>DESCRIPCION DEL PRODUCTO</TableCell>
              <TableCell align="center">STOCK</TableCell>
              <TableCell align="center">CANT.</TableCell>
              <TableCell align="right">P. UNITARIO</TableCell>
              <TableCell align="right">SUBTOTAL</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>

          <TableBody>
            {lineas.map((linea) => (
              <FilaTicket key={linea.producto.id} linea={linea} />
            ))}

            {/* ticket vacio */}
            {lineas.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>
                  Escanee un codigo de barras o presione F2 para buscar un producto.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* resumen */}
      <Box
        sx={{
          display: 'flex',
          gap: 3,
          px: 2,
          py: 1,
          bgcolor: 'action.hover',
          borderTop: 1, borderTopColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <ListAltIcon fontSize="small" color="primary" />
          <Typography variant="body2">
            <b>{cantidadLineas}</b> lineas activas
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Inventory2OutlinedIcon fontSize="small" color="primary" />
          <Typography variant="body2">
            <b>{unidades}</b> unidades fisicas
          </Typography>
        </Box>
      </Box>
    </Paper>
  )
}

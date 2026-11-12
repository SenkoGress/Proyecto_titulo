// src/features/pos/components/tecnico/CatalogoTecnico.tsx
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import Skeleton from '@mui/material/Skeleton'
import { formatoClp } from '@/shared/utils/formatoClp'
import { useProductos } from '@/features/pos/hooks/usePos'
import { useCarritoStore } from '@/features/pos/stores/carritoStore'

// el catalogo ocupa el espacio del ticket mientras no hay nada vendido: con la caja vacia esa
// zona solo tenia un mensaje, y sin saberse el nombre ni el codigo no habia por donde empezar
export function CatalogoTecnico() {
  const { data: productos = [], isPending } = useProductos()
  const agregar = useCarritoStore((estado) => estado.agregar)

  if (isPending) return <Skeleton variant="rounded" sx={{ flexGrow: 1 }} />

  return (
    <Paper
      elevation={0}
      sx={{
        flexGrow: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        border: 1,
        borderColor: 'divider',
        borderRadius: 2,
        overflow: 'hidden',
      }}
    >
      <TableContainer sx={{ flexGrow: 1 }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow sx={{ '& th': { whiteSpace: 'nowrap' } }}>
              <TableCell>SKU / CODIGO</TableCell>
              <TableCell>PRODUCTO</TableCell>
              <TableCell align="center">STOCK</TableCell>
              <TableCell align="right">PRECIO</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {productos.map((producto) => {
              const agotado = producto.stock_actual <= 0

              return (
                <TableRow
                  key={producto.id}
                  hover={!agotado}
                  onClick={() => !agotado && agregar(producto)}
                  sx={{ cursor: agotado ? 'default' : 'pointer', opacity: agotado ? 0.5 : 1 }}
                >
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: 12, whiteSpace: 'nowrap' }}>
                    {producto.codigo_barra ?? producto.sku}
                  </TableCell>

                  <TableCell sx={{ fontWeight: 600 }}>{producto.nombre}</TableCell>

                  <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                    {agotado ? 'Sin stock' : `${producto.stock_actual} un`}
                  </TableCell>

                  <TableCell align="right" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {formatoClp(producto.precio_venta)}
                  </TableCell>
                </TableRow>
              )
            })}

            {productos.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>
                  Todavia no hay productos en el catalogo.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ px: 1.5, py: 1, borderTop: 1, borderColor: 'divider' }}>
        <Typography variant="caption" color="text.secondary">
          Toca un producto para agregarlo. Al empezar la venta, aca va el detalle del ticket.
        </Typography>
      </Box>
    </Paper>
  )
}

// src/features/dashboard/components/compartidos/TablaArticulosLideres.tsx
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableBody from '@mui/material/TableBody'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import Chip from '@mui/material/Chip'
import LinearProgress from '@mui/material/LinearProgress'
import { formatoClp } from '@/shared/utils/formatoClp'
import type { ProductoTop } from '@/features/dashboard/types'

type Props = {
  productos: ProductoTop[]
  conParticipacion: boolean
}

// detalle de los productos del grafico de arriba
export function TablaArticulosLideres({ productos, conParticipacion }: Props) {
  const totalIngresos = productos.reduce((suma, producto) => suma + producto.ingresos, 0)

  return (
    <Paper variant="outlined" sx={{ p: 2.5, height: '100%' }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
        Detalle de articulos lideres
      </Typography>

      {productos.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Sin ventas en este periodo.
        </Typography>
      ) : (
        <TableContainer sx={{ maxHeight: 320 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Producto</TableCell>
                <TableCell>Categoria</TableCell>
                <TableCell align="right">Vendidos</TableCell>
                <TableCell align="right">Ingresos</TableCell>
                {conParticipacion && <TableCell>Participacion</TableCell>}
              </TableRow>
            </TableHead>

            <TableBody>
              {productos.map((producto) => {
                const porcentaje = totalIngresos > 0 ? Math.round((producto.ingresos / totalIngresos) * 100) : 0

                return (
                  <TableRow key={producto.sku} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {producto.nombre}
                      </Typography>
                      <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                        {producto.sku}
                      </Typography>
                    </TableCell>

                    <TableCell>
                      <Chip label={producto.categoria} size="small" variant="outlined" />
                    </TableCell>

                    <TableCell align="right" sx={{ fontWeight: 600 }}>
                      {producto.unidades} u
                    </TableCell>

                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                      {formatoClp(producto.ingresos)}
                    </TableCell>

                    {conParticipacion && (
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 110 }}>
                          <LinearProgress
                            variant="determinate"
                            value={porcentaje}
                            sx={{ flexGrow: 1, height: 6, borderRadius: 3 }}
                          />
                          <Typography variant="caption" sx={{ fontWeight: 600, minWidth: 32, textAlign: 'right' }}>
                            {porcentaje}%
                          </Typography>
                        </Box>
                      </TableCell>
                    )}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Paper>
  )
}

// src/features/inventario/components/compartidos/DialogoHistorialProducto.tsx
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import Skeleton from '@mui/material/Skeleton'
import { ErrorBox } from '@/shared/components/ui/ErrorBox'
import { formatFecha } from '@/shared/utils/formatFecha'
import { useHistorialProducto } from '@/features/inventario/hooks/useInventario'
import {
  colorMovimiento,
  nombreMovimiento,
  nombreRegistro,
  resumirMovimientos,
} from '@/features/inventario/utils/movimientos'
import type { ProductoInventario } from '@/features/inventario/types'

type Props = {
  abierto: boolean
  onCerrar: () => void
  producto: ProductoInventario | null
}

// linea de tiempo del stock de un producto
export function DialogoHistorialProducto({ abierto, onCerrar, producto }: Props) {
  const historial = useHistorialProducto(abierto && producto ? producto.id : null)
  const movimientos = historial.data ?? []
  const resumen = resumirMovimientos(movimientos)

  return (
    <Dialog open={abierto} onClose={onCerrar} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pb: 0.5 }}>
        Movimientos del producto
        {producto && (
          <Typography variant="body2" color="text.secondary">
            {producto.nombre}
          </Typography>
        )}
      </DialogTitle>

      <DialogContent dividers>
        {historial.isError && <ErrorBox error={historial.error} />}
        {historial.isPending && <Skeleton variant="rounded" height={240} />}

        {historial.isSuccess && movimientos.length === 0 && (
          <Typography color="text.secondary">Este producto todavia no tiene movimientos.</Typography>
        )}

        {movimientos.length > 0 && (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              {resumen.total} movimientos · entraron {resumen.entradas} · salieron {resumen.salidas}
            </Typography>

            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Fecha</TableCell>
                  <TableCell>Tipo</TableCell>
                  <TableCell align="right">Cambio</TableCell>
                  <TableCell align="right">Stock</TableCell>
                  <TableCell>Motivo</TableCell>
                  <TableCell>Registro</TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {movimientos.map((movimiento) => (
                  <TableRow key={movimiento.id}>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {formatFecha(movimiento.fecha_movimiento)}
                    </TableCell>

                    <TableCell>
                      <Chip
                        size="small"
                        label={nombreMovimiento(movimiento.tipo_movimiento)}
                        color={colorMovimiento(movimiento.tipo_movimiento)}
                      />
                    </TableCell>

                    <TableCell
                      align="right"
                      sx={{
                        fontWeight: 700,
                        color: movimiento.cambio < 0 ? 'error.main' : 'success.main',
                      }}
                    >
                      {movimiento.cambio > 0 ? `+${movimiento.cambio}` : movimiento.cambio}
                    </TableCell>

                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      <Typography variant="caption" color="text.secondary">
                        {movimiento.cambio_anterior} →{' '}
                      </Typography>
                      <Typography variant="body2" component="span" sx={{ fontWeight: 600 }}>
                        {movimiento.nuevo_stock}
                      </Typography>
                    </TableCell>

                    <TableCell sx={{ maxWidth: 240 }}>
                      <Typography variant="caption" color="text.secondary">
                        {movimiento.motivo || '-'}
                      </Typography>
                    </TableCell>

                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {nombreRegistro(movimiento.usuario_registro)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary">
                Se muestran los ultimos 50 movimientos, del mas nuevo al mas antiguo.
              </Typography>
            </Box>
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button variant="contained" onClick={onCerrar}>
          Cerrar
        </Button>
      </DialogActions>
    </Dialog>
  )
}

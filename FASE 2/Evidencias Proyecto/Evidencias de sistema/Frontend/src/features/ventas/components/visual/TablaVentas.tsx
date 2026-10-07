// src/features/ventas/components/visual/TablaVentas.tsx
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableBody from '@mui/material/TableBody'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TablePagination from '@mui/material/TablePagination'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import Tooltip from '@mui/material/Tooltip'
import Skeleton from '@mui/material/Skeleton'
import ReceiptLongOutlined from '@mui/icons-material/ReceiptLongOutlined'
import AssignmentReturnOutlined from '@mui/icons-material/AssignmentReturnOutlined'
import { formatoClp } from '@/shared/utils/formatoClp'
import { formatFecha } from '@/shared/utils/formatFecha'
import { detalleProductos } from '@/features/ventas/utils/filaVenta'
import type { FilaVenta } from '@/features/ventas/utils/filaVenta'

type Props = {
  ventas: FilaVenta[]
  cargando: boolean
  pagina: number
  porPagina: number
  onPagina: (pagina: number) => void
  onPorPagina: (cantidad: number) => void
  onVerTicket: (venta: FilaVenta) => void
  onDevolver: (venta: FilaVenta) => void
}

// registro de ventas del local, una fila por boleta
export function TablaVentas({
  ventas,
  cargando,
  pagina,
  porPagina,
  onPagina,
  onPorPagina,
  onVerTicket,
  onDevolver,
}: Props) {
  const visibles = ventas.slice(pagina * porPagina, pagina * porPagina + porPagina)

  if (cargando) return <Skeleton variant="rounded" height={420} />

  return (
    <Paper variant="outlined">
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Fecha y hora</TableCell>
              <TableCell>Que se vendio</TableCell>
              <TableCell>Cajero</TableCell>
              <TableCell>Como pago</TableCell>
              <TableCell align="right">Total</TableCell>
              <TableCell align="center">Boleta</TableCell>
              <TableCell align="center">Devolucion</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {visibles.length === 0 && (
              <TableRow>
                <TableCell colSpan={7}>
                  <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                    No hay ventas que coincidan con lo que buscas.
                  </Typography>
                </TableCell>
              </TableRow>
            )}

            {visibles.map((venta) => (
              <TableRow key={venta.id} hover>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {formatFecha(venta.fecha)}
                  </Typography>
                  <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                    {venta.folio}
                  </Typography>
                </TableCell>

                <TableCell sx={{ maxWidth: 320 }}>
                  {venta.esDevolucion ? (
                    <>
                      <Chip label="DEVOLUCION" size="small" color="warning" sx={{ fontWeight: 700 }} />
                      {venta.folioAnulado && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          Anula la venta {venta.folioAnulado}
                        </Typography>
                      )}
                    </>
                  ) : (
                    <Tooltip title={detalleProductos(venta)}>
                      <Typography variant="body2" noWrap>
                        {detalleProductos(venta)}
                      </Typography>
                    </Tooltip>
                  )}
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    {venta.unidades} {venta.unidades === 1 ? 'unidad' : 'unidades'}
                  </Typography>
                </TableCell>

                <TableCell>{venta.cajero_nombre}</TableCell>

                <TableCell>
                  <Chip label={venta.medio_pago_nombre} size="small" variant="outlined" />
                </TableCell>

                <TableCell align="right">
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: 700, color: venta.esDevolucion ? 'warning.main' : 'success.main' }}
                  >
                    {formatoClp(venta.total)}
                  </Typography>
                </TableCell>

                <TableCell align="center">
                  <Tooltip title={venta.dte ? 'Ver e imprimir el comprobante' : 'Esta venta no genero boleta'}>
                    <span>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<ReceiptLongOutlined />}
                        onClick={() => onVerTicket(venta)}
                      >
                        Ver
                      </Button>
                    </span>
                  </Tooltip>
                </TableCell>

                <TableCell align="center">
                  <Tooltip
                    title={
                      venta.esDevolucion
                        ? 'Esto ya es una devolucion'
                        : venta.items.length === 0
                          ? 'La venta no tiene productos registrados'
                          : 'Devolver y emitir nota de credito'
                    }
                  >
                    <span>
                      <Button
                        size="small"
                        color="warning"
                        startIcon={<AssignmentReturnOutlined />}
                        disabled={venta.esDevolucion || venta.items.length === 0}
                        onClick={() => onDevolver(venta)}
                      >
                        Devolver
                      </Button>
                    </span>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <TablePagination
          component="div"
          count={ventas.length}
          page={pagina}
          rowsPerPage={porPagina}
          rowsPerPageOptions={[10, 25, 50]}
          labelRowsPerPage="Filas por pagina"
          labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
          onPageChange={(_, nueva) => onPagina(nueva)}
          onRowsPerPageChange={(evento) => {
            onPorPagina(Number(evento.target.value))
            onPagina(0)
          }}
        />
      </Box>
    </Paper>
  )
}

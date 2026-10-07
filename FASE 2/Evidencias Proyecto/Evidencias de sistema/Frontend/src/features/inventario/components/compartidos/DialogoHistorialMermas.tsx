// src/features/inventario/components/compartidos/DialogoHistorialMermas.tsx
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
import DownloadIcon from '@mui/icons-material/Download'
import { ErrorBox } from '@/shared/components/ui/ErrorBox'
import { formatFecha } from '@/shared/utils/formatFecha'
import { useMermas } from '@/features/inventario/hooks/useInventario'
import { exportarMermasCsv } from '@/features/inventario/utils/exportarMermasCsv'

type Props = {
  abierto: boolean
  onCerrar: () => void
}

const COLOR_MOTIVO: Record<string, 'error' | 'warning' | 'default'> = {
  vencimiento: 'error',
  deterioro: 'warning',
  rotura: 'warning',
  robo: 'error',
}

const NOMBRE_MOTIVO: Record<string, string> = {
  vencimiento: 'Vencido',
  rotura: 'Roto',
  deterioro: 'Mal estado',
  robo: 'Robo',
  otro: 'Otro',
}

export function DialogoHistorialMermas({ abierto, onCerrar }: Props) {
  const mermas = useMermas()
  const filas = mermas.data ?? []
  const unidades = filas.reduce((suma, merma) => suma + Number(merma.cantidad), 0)

  return (
    <Dialog open={abierto} onClose={onCerrar} maxWidth="md" fullWidth>
      <DialogTitle>Historial de mermas</DialogTitle>

      <DialogContent dividers>
        {mermas.isError && <ErrorBox error={mermas.error} />}
        {mermas.isPending && <Skeleton variant="rounded" height={240} />}

        {mermas.isSuccess && filas.length === 0 && (
          <Typography color="text.secondary">Todavia no hay bajas registradas.</Typography>
        )}

        {filas.length > 0 && (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              {filas.length} {filas.length === 1 ? 'baja' : 'bajas'}, {unidades}{' '}
              {unidades === 1 ? 'unidad' : 'unidades'} en total
            </Typography>

            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Fecha</TableCell>
                  <TableCell>Producto</TableCell>
                  <TableCell align="right">Cantidad</TableCell>
                  <TableCell>Motivo</TableCell>
                  <TableCell>Detalle</TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {filas.map((merma) => (
                  <TableRow key={merma.id}>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatFecha(merma.fecha)}</TableCell>

                    <TableCell>
                      <Typography variant="body2">{merma.producto_nombre ?? 'Producto eliminado'}</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                        {merma.sku}
                      </Typography>
                    </TableCell>

                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                      {merma.cantidad}
                    </TableCell>

                    <TableCell>
                      <Chip
                        size="small"
                        label={NOMBRE_MOTIVO[merma.motivo] ?? merma.motivo}
                        color={COLOR_MOTIVO[merma.motivo] ?? 'default'}
                      />
                    </TableCell>

                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {merma.observaciones || '-'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary">
                Guarda este registro: el D.S. 977/96 pide poder demostrar que el producto vencido salio de
                la venta.
              </Typography>
            </Box>
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button
          startIcon={<DownloadIcon />}
          onClick={() => exportarMermasCsv(filas)}
          disabled={filas.length === 0}
        >
          Exportar CSV
        </Button>
        <Button variant="contained" onClick={onCerrar}>
          Cerrar
        </Button>
      </DialogActions>
    </Dialog>
  )
}

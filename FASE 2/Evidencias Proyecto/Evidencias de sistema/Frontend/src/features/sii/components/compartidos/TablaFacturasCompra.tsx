// src/features/sii/components/compartidos/TablaFacturasCompra.tsx
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
import Skeleton from '@mui/material/Skeleton'
import Tooltip from '@mui/material/Tooltip'
import { formatoClp } from '@/shared/utils/formatoClp'
import { formatFechaSola } from '@/shared/utils/formatFecha'
import type { FacturaRegistrada } from '@/features/invoices/types'

type Props = {
  facturas: FacturaRegistrada[]
  cargando: boolean
  tecnico: boolean
}

// facturas de compra que dan derecho a credito fiscal
export function TablaFacturasCompra({ facturas, cargando, tecnico }: Props) {
  if (cargando) return <Skeleton variant="rounded" height={280} />

  return (
    <Paper variant="outlined">
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>N° folio</TableCell>
              <TableCell>RUT proveedor</TableCell>
              <TableCell>Razon social</TableCell>
              <TableCell>Fecha emision</TableCell>
              <TableCell align="right">Monto neto</TableCell>
              <TableCell align="right">IVA credito (19%)</TableCell>
              <TableCell align="right">Total factura</TableCell>
              {tecnico && <TableCell>Metodo ingesta</TableCell>}
              <TableCell>Estado</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {facturas.length === 0 && (
              <TableRow>
                <TableCell colSpan={tecnico ? 9 : 8}>
                  <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                    Todavia no hay facturas de compra ingresadas. Se cargan desde la pantalla de Facturas.
                  </Typography>
                </TableCell>
              </TableRow>
            )}

            {facturas.map((factura) => (
              <TableRow key={factura.id} hover>
                <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600, color: 'primary.main' }}>
                  {factura.numero_factura}
                </TableCell>

                <TableCell sx={{ fontFamily: 'monospace' }}>{factura.rut_proveedor}</TableCell>

                <TableCell sx={{ fontWeight: 600 }}>{factura.proveedor_nombre ?? 'Sin proveedor'}</TableCell>

                <TableCell>{formatFechaSola(factura.fecha_ingreso)}</TableCell>

                <TableCell align="right">{formatoClp(factura.monto_neto)}</TableCell>

                <TableCell align="right" sx={{ fontWeight: 700, color: 'info.main' }}>
                  {formatoClp(factura.iva_credito)}
                </TableCell>

                <TableCell align="right" sx={{ fontWeight: 700, color: 'success.main' }}>
                  {formatoClp(factura.total_factura)}
                </TableCell>

                {tecnico && (
                  <TableCell>
                    <Chip
                      label={factura.metodo_ingreso}
                      size="small"
                      variant="outlined"
                      sx={{ fontFamily: 'monospace', fontSize: 10 }}
                    />
                  </TableCell>
                )}

                <TableCell>
                  <Tooltip title="Estado con que el backend guarda la factura en factura_ingresos">
                    <Chip label={factura.estado} size="small" color="success" sx={{ fontWeight: 700 }} />
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ p: 1.5 }}>
        <Typography variant="caption" color="text.secondary">
          El IVA de estas compras se descuenta del IVA de tus ventas en el F29.
        </Typography>
      </Box>
    </Paper>
  )
}

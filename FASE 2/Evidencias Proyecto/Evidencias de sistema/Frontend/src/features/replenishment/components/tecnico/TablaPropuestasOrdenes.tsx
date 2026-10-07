// src/features/replenishment/components/tecnico/TablaPropuestasOrdenes.tsx
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
import Button from '@mui/material/Button'
import Tooltip from '@mui/material/Tooltip'
import Skeleton from '@mui/material/Skeleton'
import EventOutlined from '@mui/icons-material/EventOutlined'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import { formatoClp } from '@/shared/utils/formatoClp'
import { alternativas, lineasDePropuesta, motivoEleccion } from '@/features/replenishment/utils/ordenesPorProveedor'
import type { ItemOrdenSugerida, OrdenSugerida } from '@/features/replenishment/types'

type Props = {
  ordenes: OrdenSugerida[]
  cargando: boolean
  onPedir: (proveedorId: string) => void
}

// los otros proveedores que venden el mismo producto, con su precio
function Comparativa({ item, proveedorId }: { item: ItemOrdenSugerida; proveedorId: string }) {
  const otros = alternativas(item, proveedorId)
  const motivo = motivoEleccion(item, proveedorId)

  if (otros.length === 0) {
    return (
      <Typography variant="caption" color="text.secondary">
        {motivo}
      </Typography>
    )
  }

  return (
    <Tooltip
      title={otros
        .map((candidato) => `${candidato.proveedor_nombre}: ${formatoClp(candidato.precio_unitario)} c/u`)
        .join(' · ')}
    >
      <Box sx={{ cursor: 'help' }}>
        <Typography variant="caption" sx={{ fontWeight: 600, color: 'primary.main', display: 'block' }}>
          {otros.length} alternativa{otros.length === 1 ? '' : 's'}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {motivo}
        </Typography>
      </Box>
    </Tooltip>
  )
}

// propuestas de orden agrupadas por proveedor, con el comparador multiproveedor
export function TablaPropuestasOrdenes({ ordenes, cargando, onPedir }: Props) {
  if (cargando) return <Skeleton variant="rounded" height={300} />

  const lineas = lineasDePropuesta(ordenes)
  const total = ordenes.reduce((suma, orden) => suma + orden.total_estimado, 0)

  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Propuestas de ordenes de compra por proveedor
        </Typography>
        <Typography variant="body2" color="text.secondary">
          El sistema evalua el mejor precio y la visita mas proxima para recomendar al proveedor.
        </Typography>
      </Box>

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Proveedor y visita</TableCell>
              <TableCell>Producto, codigo y SKU</TableCell>
              <TableCell align="right">Stock / min</TableCell>
              <TableCell align="right">Sugerencia compra (Q)</TableCell>
              <TableCell align="right">Costo unitario</TableCell>
              <TableCell align="right">Subtotal estimado</TableCell>
              <TableCell>Alternativas</TableCell>
              <TableCell align="right">Accion</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {lineas.length === 0 && (
              <TableRow>
                <TableCell colSpan={8}>
                  <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                    No hay ordenes propuestas con los parametros actuales.
                  </Typography>
                </TableCell>
              </TableRow>
            )}

            {lineas.map(({ item, orden }) => (
              <TableRow key={`${orden.orden_id}-${item.producto_id}`} hover>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {orden.proveedor_nombre}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                    <EventOutlined sx={{ fontSize: 14, color: 'text.secondary' }} />
                    <Typography variant="caption" color="text.secondary">
                      {orden.proxima_visita.displayText}
                    </Typography>
                  </Box>
                </TableCell>

                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {item.producto_nombre}
                  </Typography>
                  <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                    {item.codigo_barra ?? 'sin codigo'} · {item.sku}
                  </Typography>
                </TableCell>

                <TableCell align="right">
                  <Typography component="span" variant="body2" sx={{ fontWeight: 700, color: 'error.main' }}>
                    {item.stock_actual}
                  </Typography>
                  <Typography component="span" variant="body2" color="text.secondary">
                    {' '}
                    / {item.stock_minimo}
                  </Typography>
                  {item.is_agotado && (
                    <Chip label="AGOTADO" size="small" color="error" sx={{ ml: 0.5, height: 18, fontSize: 10 }} />
                  )}
                </TableCell>

                <TableCell align="right">
                  <Typography variant="body2" sx={{ fontWeight: 700, color: 'success.main' }}>
                    {item.cantidad_sugerida} u
                  </Typography>
                </TableCell>

                <TableCell align="right">{formatoClp(item.costo_unitario)}</TableCell>

                <TableCell align="right" sx={{ fontWeight: 700 }}>
                  {formatoClp(item.costo_estimado)}
                </TableCell>

                <TableCell>
                  <Comparativa item={item} proveedorId={orden.proveedor_id} />
                </TableCell>

                <TableCell align="right">
                  <Tooltip title={`Armar el pedido por WhatsApp a ${orden.proveedor_nombre}`}>
                    <span>
                      <Button
                        size="small"
                        color="success"
                        startIcon={<WhatsAppIcon />}
                        onClick={() => onPedir(orden.proveedor_id)}
                      >
                        Pedir
                      </Button>
                    </span>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {lineas.length > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1.5 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Total estimado de las {ordenes.length} ordenes: {formatoClp(total)}
          </Typography>
        </Box>
      )}
    </Paper>
  )
}

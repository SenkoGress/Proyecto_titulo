// src/features/replenishment/components/tecnico/TablaAlertasRop.tsx
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
import Tooltip from '@mui/material/Tooltip'
import Skeleton from '@mui/material/Skeleton'
import EventOutlined from '@mui/icons-material/EventOutlined'
import ErrorOutlineOutlined from '@mui/icons-material/ErrorOutlineOutlined'
import { formulaRop, tiempoHastaQuiebre } from '@/features/replenishment/utils/detalleRop'
import type { FilaRop, SeveridadRop } from '@/features/replenishment/utils/detalleRop'
import type { ConfigRop } from '@/features/replenishment/types'

type Props = {
  filas: FilaRop[]
  config: ConfigRop
  cargando: boolean
}

const COLOR: Record<SeveridadRop, 'error' | 'warning'> = {
  AGOTADO: 'error',
  CRITICO: 'warning',
  PREVENTIVO: 'warning',
}

const ETIQUETA: Record<SeveridadRop, string> = {
  AGOTADO: 'AGOTADO',
  CRITICO: 'BAJO STOCK',
  PREVENTIVO: 'PREVENTIVO',
}

// productos que llegaron o pasaron su punto de reorden
export function TablaAlertasRop({ filas, config, cargando }: Props) {
  if (cargando) return <Skeleton variant="rounded" height={300} />

  const criticos = filas.filter((fila) => fila.severidad !== 'PREVENTIVO').length

  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', mb: 2, flexWrap: 'wrap' }}>
        <ErrorOutlineOutlined color="error" />

        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Productos en alerta de bajo stock y quiebre
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Items que alcanzaron o estan bajo el punto de reorden (ROP).
          </Typography>
        </Box>

        <Chip
          label={`${criticos} criticos`}
          size="small"
          color="error"
          variant="outlined"
          sx={{ fontWeight: 700 }}
        />
      </Box>

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Codigo de barra</TableCell>
              <TableCell>SKU y nombre</TableCell>
              <TableCell align="right">Stock actual / min</TableCell>
              <TableCell align="right">Rotacion diaria</TableCell>
              <TableCell>ROP calculado</TableCell>
              <TableCell>Dias restantes</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell>Proveedor habitual</TableCell>
              <TableCell>Proxima visita</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {filas.length === 0 && (
              <TableRow>
                <TableCell colSpan={9}>
                  <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                    Ningun producto esta bajo su punto de reorden con los parametros actuales.
                  </Typography>
                </TableCell>
              </TableRow>
            )}

            {filas.map((fila) => (
              <TableRow key={fila.producto_id} hover>
                <TableCell sx={{ fontFamily: 'monospace', color: 'primary.main' }}>
                  {fila.codigo_barra ?? 'sin codigo'}
                </TableCell>

                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {fila.nombre}
                  </Typography>
                  <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                    {fila.sku}
                  </Typography>
                </TableCell>

                <TableCell align="right">
                  <Typography component="span" variant="body2" sx={{ fontWeight: 700, color: 'error.main' }}>
                    {fila.stock_actual}
                  </Typography>
                  <Typography component="span" variant="body2" color="text.secondary">
                    {' '}
                    / {fila.stock_minimo}
                  </Typography>
                </TableCell>

                <TableCell align="right">{fila.velocidad_diaria.toFixed(2)} u/dia</TableCell>

                <TableCell>
                  <Tooltip title="Punto de reorden = demanda diaria x dias de entrega + stock minimo">
                    <Box sx={{ cursor: 'help' }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {fila.reorder_point} un
                      </Typography>
                      <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                        {formulaRop(fila, config)}
                      </Typography>
                    </Box>
                  </Tooltip>
                </TableCell>

                <TableCell>
                  <Tooltip title={`Quiebre estimado ${tiempoHastaQuiebre(fila.dias_inventario_restante)}`}>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: 'info.main', cursor: 'help' }}>
                      {fila.dias_inventario_restante >= 999
                        ? 'sin consumo'
                        : `${fila.dias_inventario_restante} dias`}
                    </Typography>
                  </Tooltip>
                </TableCell>

                <TableCell>
                  <Chip
                    label={ETIQUETA[fila.severidad]}
                    size="small"
                    color={COLOR[fila.severidad]}
                    sx={{ fontWeight: 700 }}
                  />
                </TableCell>

                <TableCell>{fila.proveedor_nombre ?? 'Sin proveedor asignado'}</TableCell>

                <TableCell>
                  <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}>
                    <EventOutlined fontSize="small" color="action" />
                    <Typography variant="body2">{fila.proxima_visita.displayText}</Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
        "Sin consumo" significa que el producto no registra ventas en los ultimos {config.analysisDays} dias, asi
        que no se puede estimar cuanto dura el stock.
      </Typography>
    </Paper>
  )
}

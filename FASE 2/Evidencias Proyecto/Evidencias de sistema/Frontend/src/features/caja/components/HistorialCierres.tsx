// src/features/caja/components/HistorialCierres.tsx
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
import HistoryIcon from '@mui/icons-material/History'
import { formatoClp } from '@/shared/utils/formatoClp'
import { formatFecha } from '@/shared/utils/formatFecha'
import { useHistorialCaja } from '@/features/caja/hooks/useCaja'

// color y texto de la diferencia del arqueo
function Diferencia({ monto }: { monto: number | null | undefined }) {
  if (monto === null || monto === undefined) {
    return (
      <Typography variant="body2" color="text.disabled">
        —
      </Typography>
    )
  }

  if (monto === 0) {
    return (
      <Typography variant="body2" sx={{ fontWeight: 700, color: 'success.main' }}>
        Cuadrada
      </Typography>
    )
  }

  return (
    <Typography variant="body2" sx={{ fontWeight: 700, color: monto > 0 ? 'info.main' : 'error.main' }}>
      {monto > 0 ? 'Sobrante ' : 'Faltante '}
      {formatoClp(Math.abs(monto))}
    </Typography>
  )
}

// cierres Z anteriores del local
export function HistorialCierres() {
  const { data: cierres, isPending, isError } = useHistorialCaja()

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <HistoryIcon color="action" />
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          Historial de cierres de caja (Z)
        </Typography>
      </Box>

      {isPending && <Skeleton variant="rounded" height={160} />}

      {isError && (
        <Typography variant="body2" color="error">
          No se pudo cargar el historial.
        </Typography>
      )}

      {cierres && cierres.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          Todavia no hay turnos registrados.
        </Typography>
      )}

      {cierres && cierres.length > 0 && (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Fecha cierre</TableCell>
                <TableCell>Cajero</TableCell>
                <TableCell align="right">Fondo inicial</TableCell>
                <TableCell align="right">Total ventas</TableCell>
                <TableCell align="right">Efectivo esperado</TableCell>
                <TableCell align="right">Efectivo real</TableCell>
                <TableCell>Diferencia</TableCell>
                <TableCell>Estado</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {cierres.map((cierre) => (
                <TableRow key={cierre.id} hover>
                  <TableCell>
                    {cierre.estado === 'ABIERTA' ? (
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        En curso
                      </Typography>
                    ) : (
                      formatFecha(cierre.fecha_cierre ?? null)
                    )}
                  </TableCell>
                  <TableCell>{cierre.cajero_nombre ?? '—'}</TableCell>
                  <TableCell align="right">{formatoClp(cierre.monto_apertura)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>
                    {formatoClp(cierre.total_ventas)}
                  </TableCell>
                  <TableCell align="right">{formatoClp(cierre.monto_esperado_efectivo)}</TableCell>
                  <TableCell align="right">
                    {cierre.monto_real_efectivo === null || cierre.monto_real_efectivo === undefined
                      ? '—'
                      : formatoClp(cierre.monto_real_efectivo)}
                  </TableCell>
                  <TableCell>
                    <Diferencia monto={cierre.estado === 'ABIERTA' ? null : cierre.diferencia_efectivo} />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={cierre.estado}
                      size="small"
                      color={cierre.estado === 'ABIERTA' ? 'success' : 'default'}
                      variant="outlined"
                      sx={{ fontWeight: 700 }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
        Mientras el turno esta abierto, la fila "En curso" muestra los montos con que se guardo la sesion, no el
        balance en vivo de arriba.
      </Typography>
    </Paper>
  )
}

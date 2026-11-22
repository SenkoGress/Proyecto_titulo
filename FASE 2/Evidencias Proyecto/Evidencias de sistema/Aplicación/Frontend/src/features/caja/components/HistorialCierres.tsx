// src/features/caja/components/HistorialCierres.tsx
import { useState } from 'react'
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
import EditNoteOutlined from '@mui/icons-material/EditNoteOutlined'
import Button from '@mui/material/Button'
import { formatoClp } from '@/shared/utils/formatoClp'
import { formatFecha } from '@/shared/utils/formatFecha'
import { useHistorialCaja } from '@/features/caja/hooks/useCaja'
import { usePuedeAdministrar } from '@/features/auth/stores/sesionStore'
import { DialogoCorregirCierre } from '@/features/caja/components/DialogoCorregirCierre'
import { conteoVigente, diferenciaVigente, estaCorregido, sePuedeCorregir } from '@/features/caja/utils/correccionCierre'
import type { CierreHistorial } from '@/features/caja/types'

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
  const esAdmin = usePuedeAdministrar()
  const [aCorregir, setACorregir] = useState<CierreHistorial | null>(null)

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
                {esAdmin && <TableCell align="right">Conteo</TableCell>}
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
                    {conteoVigente(cierre) === null ? '—' : formatoClp(conteoVigente(cierre) as number)}
                    {estaCorregido(cierre) && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        antes {formatoClp(cierre.monto_real_efectivo ?? 0)}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Diferencia monto={cierre.estado === 'ABIERTA' ? null : diferenciaVigente(cierre)} />
                    {estaCorregido(cierre) && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        {cierre.motivo_correccion ?? 'corregida'}
                        {cierre.corregido_por_nombre ? ` · ${cierre.corregido_por_nombre}` : ''}
                      </Typography>
                    )}
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
                  {esAdmin && (
                    <TableCell align="right">
                      <Button
                        size="small"
                        startIcon={<EditNoteOutlined fontSize="small" />}
                        disabled={!sePuedeCorregir(cierre, esAdmin)}
                        onClick={() => setACorregir(cierre)}
                      >
                        {estaCorregido(cierre) ? 'Ver o corregir' : 'Corregir'}
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {aCorregir && <DialogoCorregirCierre cierre={aCorregir} onCerrar={() => setACorregir(null)} />}

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
        Mientras el turno esta abierto, la fila "En curso" muestra los montos con que se guardo la sesion, no el
        balance en vivo de arriba.
      </Typography>
    </Paper>
  )
}

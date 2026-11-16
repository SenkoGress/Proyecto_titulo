// src/features/sii/components/compartidos/PanelRcof.tsx
import { useState } from 'react'
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableBody from '@mui/material/TableBody'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Alert from '@mui/material/Alert'
import Skeleton from '@mui/material/Skeleton'
import PlayArrowOutlined from '@mui/icons-material/PlayArrowOutlined'
import { formatoClp } from '@/shared/utils/formatoClp'
import { formatFechaSola } from '@/shared/utils/formatFecha'
import { useGenerarRcof } from '@/features/sii/hooks/useSii'
import type { RegistroRcof } from '@/features/sii/types'

type Props = {
  registros: RegistroRcof[]
  cargando: boolean
}

// consumo diario de folios de boleta que hay que reportar al sii
export function PanelRcof({ registros, cargando }: Props) {
  const generar = useGenerarRcof()
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10))

  if (cargando) return <Skeleton variant="rounded" height={300} />

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Alert severity="info">
        El Reporte de Consumo de Folios resume las boletas de un dia y se envia al SII. Aca se genera y se firma,
        pero el envio todavia no existe: quedan en estado PENDIENTE.
      </Alert>

      <Paper variant="outlined" sx={{ p: 2, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField
          label="Dia a reportar"
          type="date"
          size="small"
          value={fecha}
          onChange={(evento) => setFecha(evento.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />

        <Button
          variant="contained"
          startIcon={<PlayArrowOutlined />}
          disabled={generar.isPending}
          onClick={() => generar.mutate(fecha)}
        >
          {generar.isPending ? 'Generando...' : 'Generar reporte del dia'}
        </Button>
      </Paper>

      {generar.isSuccess && (
        <Alert severity="success">
          Reporte de {formatFechaSola(generar.data.fechaReporte)} generado (secuencia {generar.data.secuencia}):{' '}
          {generar.data.cantidadBoletas} boletas por {formatoClp(generar.data.montoTotal)}
          {generar.data.cantidadBoletas > 0 && `, folios ${generar.data.folioInicial} al ${generar.data.folioFinal}`}.
        </Alert>
      )}

      {generar.isError && <Alert severity="error">{generar.error.message}</Alert>}

      <Paper variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Fecha reportada</TableCell>
              <TableCell align="right">Secuencia</TableCell>
              <TableCell align="right">Boletas</TableCell>
              <TableCell align="right">Neto</TableCell>
              <TableCell align="right">IVA</TableCell>
              <TableCell align="right">Total</TableCell>
              <TableCell>Envio</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {registros.length === 0 && (
              <TableRow>
                <TableCell colSpan={7}>
                  <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                    Todavia no se ha generado ningun reporte de consumo de folios.
                  </Typography>
                </TableCell>
              </TableRow>
            )}

            {registros.map((registro) => (
              <TableRow key={registro.id} hover>
                <TableCell sx={{ fontWeight: 600 }}>{formatFechaSola(registro.fecha_reporte)}</TableCell>
                <TableCell align="right">{registro.secuencia_envio}</TableCell>
                <TableCell align="right">{registro.cantidad_boletas}</TableCell>
                <TableCell align="right">{formatoClp(registro.total_neto)}</TableCell>
                <TableCell align="right">{formatoClp(registro.total_iva)}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>
                  {formatoClp(registro.total_ventas)}
                </TableCell>
                <TableCell>
                  <Chip
                    label={registro.estado_envio}
                    size="small"
                    color={registro.estado_envio === 'PENDIENTE' ? 'warning' : 'success'}
                    variant="outlined"
                    sx={{ fontWeight: 700, fontSize: 10 }}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  )
}

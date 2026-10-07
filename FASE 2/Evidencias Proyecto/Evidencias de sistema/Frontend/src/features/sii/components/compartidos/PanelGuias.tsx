// src/features/sii/components/compartidos/PanelGuias.tsx
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
import Alert from '@mui/material/Alert'
import Skeleton from '@mui/material/Skeleton'
import AddOutlined from '@mui/icons-material/AddOutlined'
import { formatoClp } from '@/shared/utils/formatoClp'
import { formatFecha } from '@/shared/utils/formatFecha'
import { DialogoEmitirGuia } from '@/features/sii/components/compartidos/DialogoEmitirGuia'
import type { GuiaDespacho } from '@/features/sii/types'

type Props = {
  guias: GuiaDespacho[]
  cargando: boolean
}

const TRASLADOS: Record<number, string> = {
  1: 'Venta',
  5: 'Traslado interno',
  6: 'Otros',
}

// guias de despacho electronicas emitidas
export function PanelGuias({ guias, cargando }: Props) {
  const [emitiendo, setEmitiendo] = useState(false)

  if (cargando) return <Skeleton variant="rounded" height={280} />

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Alert severity="info">
        La guia de despacho ampara el traslado de mercaderia sin que sea una venta (Ley N° 21.131). Se emite como
        DTE tipo 52 y consume un folio.
      </Alert>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="contained" startIcon={<AddOutlined />} onClick={() => setEmitiendo(true)}>
          Emitir guia de despacho
        </Button>
      </Box>

      <Paper variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell align="right">Folio</TableCell>
              <TableCell>Fecha</TableCell>
              <TableCell>Destinatario</TableCell>
              <TableCell>Destino</TableCell>
              <TableCell>Traslado</TableCell>
              <TableCell>Transporte</TableCell>
              <TableCell align="right">Items</TableCell>
              <TableCell align="right">Monto</TableCell>
              <TableCell>Estado</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {guias.length === 0 && (
              <TableRow>
                <TableCell colSpan={9}>
                  <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                    Todavia no se ha emitido ninguna guia de despacho.
                  </Typography>
                </TableCell>
              </TableRow>
            )}

            {guias.map((guia) => (
              <TableRow key={guia.id} hover>
                <TableCell align="right" sx={{ fontFamily: 'monospace', fontWeight: 700 }}>
                  {guia.folio}
                </TableCell>

                <TableCell>{formatFecha(guia.fecha_emision)}</TableCell>

                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {guia.receptor_razon_social}
                  </Typography>
                  <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                    {guia.receptor_rut}
                  </Typography>
                </TableCell>

                <TableCell>
                  <Typography variant="body2">{guia.direccion_destino}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {guia.comuna_destino}
                  </Typography>
                </TableCell>

                <TableCell>
                  <Chip
                    label={TRASLADOS[guia.tipo_traslado] ?? `Tipo ${guia.tipo_traslado}`}
                    size="small"
                    variant="outlined"
                  />
                </TableCell>

                <TableCell>
                  <Typography variant="caption" sx={{ display: 'block' }}>
                    {guia.patente_vehiculo ?? 'Sin patente'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {guia.chofer_nombre ?? 'Sin chofer'}
                  </Typography>
                </TableCell>

                <TableCell align="right">{guia.total_items}</TableCell>

                <TableCell align="right" sx={{ fontWeight: 700 }}>
                  {formatoClp(guia.monto_total)}
                </TableCell>

                <TableCell>
                  <Chip label={guia.estado} size="small" color="success" variant="outlined" sx={{ fontSize: 10 }} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      {emitiendo && <DialogoEmitirGuia onCerrar={() => setEmitiendo(false)} />}
    </Box>
  )
}

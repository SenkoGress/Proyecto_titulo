// src/features/sii/components/compartidos/TablaDtesEmitidos.tsx
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
import Button from '@mui/material/Button'
import Skeleton from '@mui/material/Skeleton'
import DownloadOutlined from '@mui/icons-material/DownloadOutlined'
import { formatoClp } from '@/shared/utils/formatoClp'
import { formatFecha } from '@/shared/utils/formatFecha'
import { etiquetaEstadoSii } from '@/shared/utils/etiquetasEstado'
import { nombreDocumentoDte } from '@/features/dte/utils/nombreDte'
import { descargarXmlDte } from '@/features/dte/api/dte.api'
import type { DteEmitido } from '@/features/ventas/types'

type Props = {
  dtes: DteEmitido[]
  cargando: boolean
  tecnico: boolean
}

// color del chip segun si suma o resta al debito fiscal
function colorTipo(tipoDte: number): 'primary' | 'info' | 'warning' {
  if (tipoDte === 61) return 'warning'
  if (tipoDte === 33 || tipoDte === 34) return 'info'
  return 'primary'
}

async function descargar(dte: DteEmitido) {
  const xml = await descargarXmlDte(dte.id)
  const blob = new Blob([xml], { type: 'application/xml' })
  const url = URL.createObjectURL(blob)

  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = `DTE_${dte.tipo_dte}_F${dte.folio}.xml`
  enlace.click()

  URL.revokeObjectURL(url)
}

// boletas, facturas y notas de credito que emitio el local
export function TablaDtesEmitidos({ dtes, cargando, tecnico }: Props) {
  if (cargando) return <Skeleton variant="rounded" height={280} />

  return (
    <Paper variant="outlined">
      <TableContainer sx={{ maxHeight: 460 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            {/* sin esto los titulos se parten en dos lineas y la tabla se lee mal */}
            <TableRow sx={{ '& th': { whiteSpace: 'nowrap' } }}>
              <TableCell>Documento</TableCell>
              <TableCell align="right">Folio</TableCell>
              <TableCell>Fecha emision</TableCell>
              <TableCell>Receptor</TableCell>
              <TableCell align="right">Neto</TableCell>
              <TableCell align="right">IVA</TableCell>
              <TableCell align="right">Total</TableCell>
              <TableCell>Estado SII</TableCell>
              {tecnico && <TableCell align="center">XML</TableCell>}
            </TableRow>
          </TableHead>

          <TableBody>
            {dtes.length === 0 && (
              <TableRow>
                <TableCell colSpan={tecnico ? 9 : 8}>
                  <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                    Todavia no se ha emitido ningun documento.
                  </Typography>
                </TableCell>
              </TableRow>
            )}

            {dtes.map((dte) => (
              <TableRow key={dte.id} hover>
                <TableCell>
                  <Chip
                    label={nombreDocumentoDte(dte.tipo_dte)}
                    size="small"
                    color={colorTipo(dte.tipo_dte)}
                    variant="outlined"
                    sx={{ fontWeight: 700 }}
                  />
                </TableCell>

                <TableCell align="right" sx={{ fontFamily: 'monospace', fontWeight: 700 }}>
                  {dte.folio}
                </TableCell>

                <TableCell>{formatFecha(dte.fecha_emision)}</TableCell>

                <TableCell sx={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                  {dte.rut_receptor ?? '66.666.666-6'}
                </TableCell>

                <TableCell align="right">{formatoClp(dte.monto_neto)}</TableCell>

                <TableCell align="right">{formatoClp(dte.monto_iva)}</TableCell>

                <TableCell align="right" sx={{ fontWeight: 700 }}>
                  {formatoClp(dte.monto_total)}
                </TableCell>

                <TableCell>
                  <Tooltip title={etiquetaEstadoSii(dte.estado_sii).codigo}>
                    <Chip
                      label={etiquetaEstadoSii(dte.estado_sii).texto}
                      color={etiquetaEstadoSii(dte.estado_sii).tono}
                      size="small"
                      variant="outlined"
                      sx={{ whiteSpace: 'nowrap' }}
                    />
                  </Tooltip>
                </TableCell>

                {tecnico && (
                  <TableCell align="center">
                    <Button size="small" startIcon={<DownloadOutlined />} onClick={() => descargar(dte)}>
                      XML
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ p: 1.5 }}>
        <Typography variant="caption" color="text.secondary">
          Los documentos se firman y timbran localmente con folios CAF. "Emitido en el local" significa que
          todavia no se envian al SII: el backend no tiene esa conexion.
        </Typography>
      </Box>
    </Paper>
  )
}

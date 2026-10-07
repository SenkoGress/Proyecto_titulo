// src/features/sii/components/compartidos/PanelF29.tsx
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableBody from '@mui/material/TableBody'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import Divider from '@mui/material/Divider'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Skeleton from '@mui/material/Skeleton'
import Tooltip from '@mui/material/Tooltip'
import { alpha, useTheme } from '@mui/material/styles'
import FileDownloadOutlined from '@mui/icons-material/FileDownloadOutlined'
import { formatoClp } from '@/shared/utils/formatoClp'
import { exportarF29Csv } from '@/features/sii/utils/exportarF29Csv'
import type { ItemF29, ReporteF29 } from '@/features/sii/types'

type Props = {
  reporte: ReporteF29 | undefined
  cargando: boolean
  periodo: string
  tecnico: boolean
  onPeriodo: (periodo: string) => void
}

function Bloque({
  titulo,
  descripcion,
  items,
  totalNeto,
  totalIva,
  etiquetaIva,
}: {
  titulo: string
  descripcion: string
  items: ItemF29[]
  totalNeto: number
  totalIva: number
  etiquetaIva: string
}) {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
        {titulo}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {descripcion}
      </Typography>

      <Table size="small" sx={{ mt: 1 }}>
        <TableHead>
          <TableRow>
            <TableCell>Documento</TableCell>
            <TableCell align="right">Cant.</TableCell>
            <TableCell align="right">Neto</TableCell>
            <TableCell align="right">IVA</TableCell>
          </TableRow>
        </TableHead>

        <TableBody>
          {items.map((item) => (
            <TableRow key={item.tipoDocumento}>
              <TableCell>{item.tipoDocumento}</TableCell>
              <TableCell align="right">{item.cantidad}</TableCell>
              <TableCell align="right">{formatoClp(item.montoNeto)}</TableCell>
              <TableCell align="right">{formatoClp(item.montoIva)}</TableCell>
            </TableRow>
          ))}

          <TableRow>
            <TableCell sx={{ fontWeight: 700 }}>{etiquetaIva}</TableCell>
            <TableCell />
            <TableCell align="right" sx={{ fontWeight: 700 }}>
              {formatoClp(totalNeto)}
            </TableCell>
            <TableCell align="right" sx={{ fontWeight: 700 }}>
              {formatoClp(totalIva)}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </Paper>
  )
}

// pre-liquidacion del formulario 29 del mes
export function PanelF29({ reporte, cargando, periodo, tecnico, onPeriodo }: Props) {
  const theme = useTheme()

  if (cargando || !reporte) return <Skeleton variant="rounded" height={420} />

  const { debitoFiscal, creditoFiscal, balance } = reporte
  const aPagar = balance.ivaDeterminadoAPagar > 0

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Paper variant="outlined" sx={{ p: 2, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField
          label="Periodo"
          type="month"
          size="small"
          value={periodo}
          onChange={(evento) => onPeriodo(evento.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />

        <Box sx={{ flexGrow: 1 }} />

        <Button
          size="small"
          variant="outlined"
          startIcon={<FileDownloadOutlined />}
          onClick={() => exportarF29Csv(reporte)}
        >
          Exportar F29 CSV
        </Button>
      </Paper>

      <Alert severity="info">
        Esto es una <b>pre-liquidacion</b> con los documentos que tiene el sistema. El F29 se declara en el sitio
        del SII; sirve para llegar con los numeros cuadrados.
      </Alert>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, 1fr)' } }}>
        <Bloque
          titulo="Debito fiscal"
          descripcion="El IVA que cobraste en tus ventas"
          items={debitoFiscal.items}
          totalNeto={debitoFiscal.totalNeto}
          totalIva={debitoFiscal.totalIvaDebito}
          etiquetaIva="Total debito"
        />

        <Bloque
          titulo="Credito fiscal"
          descripcion="El IVA que pagaste al comprarle a tus proveedores"
          items={creditoFiscal.items}
          totalNeto={creditoFiscal.totalNeto}
          totalIva={creditoFiscal.totalIvaCredito}
          etiquetaIva="Total credito"
        />
      </Box>

      <Paper
        variant="outlined"
        sx={{ p: 2.5, borderColor: alpha(theme.palette.primary.main, 0.4), borderWidth: 2 }}
      >
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
          Resultado del periodo {reporte.periodo}
        </Typography>

        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))' }}>
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
              IVA DETERMINADO
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, color: aPagar ? 'error.main' : 'success.main' }}>
              {formatoClp(balance.ivaDeterminadoAPagar)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {aPagar ? 'Hay que pagarlo' : 'No corresponde pagar IVA'}
            </Typography>
          </Box>

          <Box>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
              REMANENTE A FAVOR
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, color: 'info.main' }}>
              {formatoClp(balance.remanenteCreditoFiscal)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Queda para el mes siguiente
            </Typography>
          </Box>

          <Box>
            <Tooltip title="Impuesto especifico a bebidas alcoholicas y azucaradas del periodo">
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', cursor: 'help' }}>
                IMPUESTO ILA
              </Typography>
            </Tooltip>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {formatoClp(debitoFiscal.totalIla)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Se paga aparte del IVA
            </Typography>
          </Box>

          <Box>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
              PPM ({balance.tasaPpm}%)
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {formatoClp(balance.montoPpm)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Pago provisional mensual
            </Typography>
          </Box>

          <Box>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'primary.main' }}>
              TOTAL A PAGAR
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main' }}>
              {formatoClp(balance.totalImpuestoPagarF29)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              IVA + ILA + PPM
            </Typography>
          </Box>
        </Box>

        {tecnico && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography variant="caption" color="text.secondary">
              La tasa PPM viene fija en 1% desde el backend (parametro `tasaPpm` de GET /dte/f29). No hay pantalla
              para configurarla por tenant.
            </Typography>
          </>
        )}
      </Paper>
    </Box>
  )
}

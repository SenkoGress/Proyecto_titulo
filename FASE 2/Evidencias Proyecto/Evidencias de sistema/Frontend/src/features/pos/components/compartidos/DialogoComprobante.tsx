// src/features/pos/components/compartidos/DialogoComprobante.tsx
import { useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import Skeleton from '@mui/material/Skeleton'
import Tooltip from '@mui/material/Tooltip'
import ReceiptLongOutlined from '@mui/icons-material/ReceiptLongOutlined'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import PrintOutlined from '@mui/icons-material/PrintOutlined'
import DownloadOutlined from '@mui/icons-material/DownloadOutlined'
import SendOutlined from '@mui/icons-material/SendOutlined'
import { formatoClp } from '@/shared/utils/formatoClp'
import { useComprobante, useConfigDte, useEnviarComprobante } from '@/features/dte/hooks/useConfigDte'
import { descargarXmlDte } from '@/features/dte/api/dte.api'
import { TicketImpreso } from '@/features/pos/components/compartidos/TicketImpreso'
import { imprimirTicket } from '@/features/pos/utils/imprimirTicket'
import type { VentaRegistrada } from '@/features/pos/types'

type Props = {
  venta: VentaRegistrada
  ajusteRedondeo: number
  onCerrar: () => void
}

function esCorreoValido(correo: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim())
}

// comprobante fiscal de la venta recien cobrada
export function DialogoComprobante({ venta, ajusteRedondeo, onCerrar }: Props) {
  const dteId = venta.dte?.esTributarioDte ? venta.dte.dteId : undefined

  const comprobante = useComprobante(dteId)
  const configDte = useConfigDte()
  const envio = useEnviarComprobante()

  const [correo, setCorreo] = useState('')
  const [errorXml, setErrorXml] = useState<string | null>(null)

  const descargarXml = async () => {
    if (!dteId) return
    setErrorXml(null)

    try {
      const xml = await descargarXmlDte(dteId)
      const blob = new Blob([xml], { type: 'application/xml' })
      const url = URL.createObjectURL(blob)

      const enlace = document.createElement('a')
      enlace.href = url
      enlace.download = `DTE_${venta.dte?.tipoDte}_F${venta.dte?.folio}.xml`
      enlace.click()

      URL.revokeObjectURL(url)
    } catch (error) {
      setErrorXml(error instanceof Error ? error.message : 'No se pudo descargar el XML')
    }
  }

  return (
    <Dialog open onClose={onCerrar} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <ReceiptLongOutlined color="primary" />
        <Box sx={{ flexGrow: 1 }}>Comprobante de venta</Box>
        <IconButton size="small" onClick={onCerrar} aria-label="Cerrar">
          <CloseOutlined fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {/* pagos con tarjeta bajo modelo B: el voucher reemplaza a la boleta */}
        {venta.dte && !venta.dte.esTributarioDte && (
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {venta.dte.tipoDocumento}
            </Typography>
            {venta.dte.mensajeLegal}
          </Alert>
        )}

        {!venta.dte && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            La venta quedó registrada, pero el backend no devolvió documento tributario.
          </Alert>
        )}

        {dteId && comprobante.isPending && <Skeleton variant="rounded" height={380} />}

        {dteId && comprobante.isError && (
          <Alert severity="error">No se pudo cargar el comprobante: {comprobante.error.message}</Alert>
        )}

        {comprobante.data && (
          <TicketImpreso
            comprobante={comprobante.data}
            emisor={configDte.data?.emisor}
            metodoPago={venta.payment_method}
            ajusteRedondeo={ajusteRedondeo}
          />
        )}

        {/* sin dte tributario igual se muestra el monto cobrado */}
        {!dteId && (
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              {formatoClp(venta.total)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Folio interno {venta.folio} · {venta.unidades} articulo(s)
            </Typography>
          </Box>
        )}

        {errorXml && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {errorXml}
          </Alert>
        )}

        {/* envio al cliente */}
        <Box sx={{ mt: 2, display: 'flex', gap: 1, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <TextField
            label="Correo del cliente"
            type="email"
            size="small"
            value={correo}
            onChange={(evento) => setCorreo(evento.target.value)}
            placeholder="cliente@ejemplo.cl"
            sx={{ flexGrow: 1, minWidth: 220 }}
          />

          <Button
            variant="outlined"
            startIcon={<SendOutlined />}
            disabled={!esCorreoValido(correo) || envio.isPending}
            onClick={() => envio.mutate({ correo: correo.trim(), dteId, ventaId: venta.saleId })}
            sx={{ mt: 0.25 }}
          >
            {envio.isPending ? 'Enviando...' : 'Enviar'}
          </Button>
        </Box>

        {envio.isSuccess && (
          <Alert severity="success" sx={{ mt: 1.5 }}>
            {envio.data.message}
            <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
              Ojo: hoy el backend solo simula el envío, todavía no despacha el correo de verdad.
            </Typography>
          </Alert>
        )}

        {envio.isError && (
          <Alert severity="error" sx={{ mt: 1.5 }}>
            {envio.error.message}
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, gap: 1, flexWrap: 'wrap' }}>
        <Tooltip title={comprobante.data ? '' : 'No hay comprobante que imprimir'}>
          <span>
            <Button
              startIcon={<PrintOutlined />}
              onClick={imprimirTicket}
              disabled={!comprobante.data}
            >
              Imprimir ticket (80mm)
            </Button>
          </span>
        </Tooltip>

        <Tooltip title={dteId ? '' : 'Solo los documentos tributarios tienen XML'}>
          <span>
            <Button startIcon={<DownloadOutlined />} onClick={descargarXml} disabled={!dteId}>
              Descargar XML DTE
            </Button>
          </span>
        </Tooltip>

        <Box sx={{ flexGrow: 1 }} />

        <Button variant="contained" onClick={onCerrar} autoFocus>
          Nueva venta
        </Button>
      </DialogActions>
    </Dialog>
  )
}

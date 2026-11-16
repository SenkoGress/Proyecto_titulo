// src/features/invoices/components/compartidos/BotonDocumentoFactura.tsx
import { useState } from 'react'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import CircularProgress from '@mui/material/CircularProgress'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import DescriptionOutlined from '@mui/icons-material/DescriptionOutlined'
import { abrirDocumentoFactura } from '@/features/invoices/api/invoices.api'
import { obtenerMensajeError } from '@/lib/api/apiError'
import type { FacturaRegistrada } from '@/features/invoices/types'

type Props = {
  factura: FacturaRegistrada
}

// abre el archivo original de la factura, que es el respaldo para el contador
export function BotonDocumentoFactura({ factura }: Props) {
  const [abriendo, setAbriendo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // las ingresadas antes del respaldo documental no tienen archivo
  if (!factura.archivo_nombre) {
    return (
      <Tooltip title="Esta factura se ingreso antes de que se guardara el documento">
        <span>
          <IconButton size="small" disabled>
            <DescriptionOutlined fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
    )
  }

  async function abrir() {
    setAbriendo(true)
    try {
      await abrirDocumentoFactura(factura.id, factura.archivo_nombre ?? 'factura')
    } catch (problema) {
      setError(obtenerMensajeError(problema))
    } finally {
      setAbriendo(false)
    }
  }

  return (
    <>
      <Tooltip title={`Ver ${factura.archivo_nombre}`}>
        <span>
          <IconButton size="small" onClick={abrir} disabled={abriendo}>
            {abriendo ? <CircularProgress size={18} /> : <DescriptionOutlined fontSize="small" />}
          </IconButton>
        </span>
      </Tooltip>

      <Snackbar
        open={error !== null}
        autoHideDuration={6000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      </Snackbar>
    </>
  )
}

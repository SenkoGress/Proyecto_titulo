// src/features/invoices/components/DialogoIngresoExitoso.tsx
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import { formatoClp } from '@/shared/utils/formatoClp'
import type { ResultadoIngesta } from '@/features/invoices/types'

type Props = {
  resultado: ResultadoIngesta | null
  onCerrar: () => void
}

// aviso de que la mercaderia ya quedo en el inventario
export function DialogoIngresoExitoso({ resultado, onCerrar }: Props) {
  return (
    <Dialog open={resultado !== null} onClose={onCerrar} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <CheckCircleIcon color="success" />
        Stock actualizado
      </DialogTitle>

      <DialogContent>
        {resultado && (
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {formatoClp(resultado.total)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Factura {resultado.folio_factura} · {resultado.items_count} producto(s) ingresados
            </Typography>

            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
              Motor: {resultado.ocr_provider} {resultado.used_fallback ? '(respaldo)' : ''} ·{' '}
              {resultado.duration_ms} ms
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button variant="contained" onClick={onCerrar} autoFocus>
          Subir otra factura
        </Button>
      </DialogActions>
    </Dialog>
  )
}

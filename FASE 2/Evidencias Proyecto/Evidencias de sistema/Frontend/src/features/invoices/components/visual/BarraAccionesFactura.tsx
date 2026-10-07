// src/features/invoices/components/BarraAccionesFactura.tsx
import Paper from '@mui/material/Paper'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined'
import { ErrorBox } from '@/shared/components/ui/ErrorBox'

type Props = {
  onCancelar: () => void
  onConfirmar: () => void
  confirmando: boolean
  errorConfirmar: unknown
}

// cancelar la revision o aprobar e ingresar a stock
export function BarraAccionesFactura({ onCancelar, onConfirmar, confirmando, errorConfirmar }: Props) {
  return (
    <Paper variant="outlined" sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
      {Boolean(errorConfirmar) && <ErrorBox error={errorConfirmar} />}

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
        <Button color="inherit" onClick={onCancelar} disabled={confirmando}>
          Cancelar
        </Button>

        <Button
          variant="contained"
          startIcon={confirmando ? <CircularProgress size={18} color="inherit" /> : <CheckCircleOutlineIcon />}
          onClick={onConfirmar}
          disabled={confirmando}
        >
          {confirmando ? 'Ingresando a stock...' : 'Aprobar y actualizar stock'}
        </Button>
      </Box>
    </Paper>
  )
}

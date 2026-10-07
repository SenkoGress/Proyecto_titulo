// src/shared/components/ui/ErrorBox.tsx
import Alert from '@mui/material/Alert'
import { obtenerMensajeError } from '@/lib/api/apiError'

type Props = {
  error: unknown
}

// aviso de error
export function ErrorBox({ error }: Props) {
  return <Alert severity="error">{obtenerMensajeError(error)}</Alert>
}

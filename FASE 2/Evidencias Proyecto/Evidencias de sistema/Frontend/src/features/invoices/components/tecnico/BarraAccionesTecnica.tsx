// src/features/invoices/components/tecnico/BarraAccionesTecnica.tsx
import { useEffect } from 'react'
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonBase from '@mui/material/ButtonBase'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import SaveIcon from '@mui/icons-material/Save'
import { ErrorBox } from '@/shared/components/ui/ErrorBox'

type Props = {
  onCancelar: () => void
  onConfirmar: () => void
  confirmando: boolean
  errorConfirmar: unknown
}

// tecla + boton, para que quede claro que las dos formas hacen lo mismo
function BotonAtajo({
  tecla,
  texto,
  onClick,
  color,
}: {
  tecla: string
  texto: string
  onClick: () => void
  color: 'error' | 'primary'
}) {
  return (
    <ButtonBase onClick={onClick} sx={{ display: 'flex', gap: 1, px: 1, py: 0.5, borderRadius: 1.5 }}>
      <Typography
        variant="caption"
        sx={{
          fontWeight: 700,
          px: 0.75,
          borderRadius: 1,
          border: 1, borderColor: 'divider',
          fontFamily: 'monospace',
        }}
      >
        {tecla}
      </Typography>
      <Typography variant="caption" color={`${color}.main`} sx={{ fontWeight: 600 }}>
        {texto}
      </Typography>
    </ButtonBase>
  )
}

// confirmar (F9) o cancelar (ESC), con atajo de teclado real
export function BarraAccionesTecnica({ onCancelar, onConfirmar, confirmando, errorConfirmar }: Props) {
  useEffect(() => {
    function alPresionar(evento: KeyboardEvent) {
      const escribiendo = evento.target instanceof HTMLInputElement
      if (evento.key === 'F9') {
        evento.preventDefault()
        onConfirmar()
      } else if (evento.key === 'Escape' && !escribiendo) {
        onCancelar()
      }
    }
    window.addEventListener('keydown', alPresionar)
    return () => window.removeEventListener('keydown', alPresionar)
  }, [onConfirmar, onCancelar])

  return (
    <Paper variant="outlined" sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
      {Boolean(errorConfirmar) && <ErrorBox error={errorConfirmar} />}

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <BotonAtajo tecla="ESC" texto="Cancelar" onClick={onCancelar} color="error" />

        <Button
          variant="contained"
          startIcon={confirmando ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
          onClick={onConfirmar}
          disabled={confirmando}
        >
          {confirmando ? 'Ingresando a stock...' : 'Confirmar e inyectar a stock [F9]'}
        </Button>
      </Box>
    </Paper>
  )
}

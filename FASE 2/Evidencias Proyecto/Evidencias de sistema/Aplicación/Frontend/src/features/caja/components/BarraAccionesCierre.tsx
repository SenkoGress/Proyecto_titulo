// src/features/caja/components/BarraAccionesCierre.tsx
import { useEffect, useState } from 'react'
import Paper from '@mui/material/Paper'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import LockIcon from '@mui/icons-material/Lock'
import { ErrorBox } from '@/shared/components/ui/ErrorBox'
import { useArqueoStore, useTotalContado } from '@/features/caja/stores/arqueoStore'
import { useCerrarCaja } from '@/features/caja/hooks/useCaja'
import type { SesionCaja } from '@/features/caja/types'

type Props = {
  onCerrado: (sesionCerrada: SesionCaja) => void
}

// cerrar el turno de una vez: pide el total contado + observaciones opcionales
export function BarraAccionesCierre({ onCerrado }: Props) {
  const revelada = useArqueoStore((estado) => estado.cuadraturaRevelada)
  const totalContado = useTotalContado()
  const [observaciones, setObservaciones] = useState('')

  const cerrar = useCerrarCaja()

  function confirmarCierre() {
    if (!revelada || cerrar.isPending) return
    cerrar.mutate(
      { montoRealEfectivo: totalContado, observaciones: observaciones.trim() || undefined },
      { onSuccess: (sesionCerrada) => onCerrado(sesionCerrada) },
    )
  }

  // atajo f10: cerrar turno
  useEffect(() => {
    function alPresionar(evento: KeyboardEvent) {
      if (evento.key === 'F10') {
        evento.preventDefault()
        confirmarCierre()
      }
    }
    window.addEventListener('keydown', alPresionar)
    return () => window.removeEventListener('keydown', alPresionar)
  })

  return (
    <Paper variant="outlined" sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <TextField
        label="Observaciones (opcional)"
        size="small"
        value={observaciones}
        onChange={(evento) => setObservaciones(evento.target.value)}
        multiline
        minRows={2}
      />

      {cerrar.isError && <ErrorBox error={cerrar.error} />}

      {!revelada && (
        <Typography variant="caption" color="text.secondary">
          Primero compara con el sistema para poder cerrar el turno.
        </Typography>
      )}

      <Button
        variant="contained"
        color="error"
        size="large"
        startIcon={cerrar.isPending ? <CircularProgress size={18} color="inherit" /> : <LockIcon />}
        disabled={!revelada || cerrar.isPending}
        onClick={confirmarCierre}
      >
        {cerrar.isPending ? 'Cerrando turno...' : 'Cerrar turno [F10]'}
      </Button>
    </Paper>
  )
}

// src/features/caja/components/EstadoSinTurno.tsx
import { useState } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import InputAdornment from '@mui/material/InputAdornment'
import CircularProgress from '@mui/material/CircularProgress'
import PointOfSaleIcon from '@mui/icons-material/PointOfSale'
import { ErrorBox } from '@/shared/components/ui/ErrorBox'
import { useAbrirCaja } from '@/features/caja/hooks/useCaja'

// cuando no hay ningun turno abierto: pedir el fondo inicial y abrir uno
export function EstadoSinTurno() {
  const [fondoInicial, setFondoInicial] = useState('50000')
  const abrir = useAbrirCaja()

  return (
    <Box sx={{ maxWidth: 420, mx: 'auto', mt: 6 }}>
      <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
        <PointOfSaleIcon sx={{ fontSize: 48, color: 'primary.main' }} />

        <Typography variant="h6" sx={{ mt: 1 }}>
          No hay un turno de caja abierto
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Ingresa el fondo inicial de la gaveta para abrir el turno
        </Typography>

        <TextField
          label="Fondo inicial"
          fullWidth
          value={fondoInicial}
          onChange={(evento) => setFondoInicial(evento.target.value.replace(/\D/g, ''))}
          slotProps={{
            input: { startAdornment: <InputAdornment position="start">$</InputAdornment> },
            htmlInput: { inputMode: 'numeric' },
          }}
          sx={{ mb: 2 }}
        />

        <Button
          variant="contained"
          fullWidth
          size="large"
          startIcon={abrir.isPending ? <CircularProgress size={18} color="inherit" /> : undefined}
          disabled={abrir.isPending}
          onClick={() => abrir.mutate(Number(fondoInicial) || 0)}
        >
          {abrir.isPending ? 'Abriendo turno...' : 'Abrir turno'}
        </Button>

        {abrir.isError && (
          <Box sx={{ mt: 2 }}>
            <ErrorBox error={abrir.error} />
          </Box>
        )}
      </Paper>
    </Box>
  )
}

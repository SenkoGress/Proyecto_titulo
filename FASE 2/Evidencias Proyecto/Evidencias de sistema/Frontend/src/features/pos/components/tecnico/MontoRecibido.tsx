// src/features/pos/components/tecnico/MontoRecibido.tsx
import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'
import { formatoClp } from '@/shared/utils/formatoClp'

type Props = {
  total: number
}

// billetes chilenos
const BILLETES = [1000, 5000, 10000, 20000]

// montos sugeridos segun el total
function sugerirMontos(total: number): number[] {
  const opciones = new Set<number>()
  for (const billete of BILLETES) {
    opciones.add(Math.ceil(total / billete) * billete)
  }
  return [...opciones].filter((monto) => monto >= total).sort((a, b) => a - b).slice(0, 3)
}

// monto recibido y vuelto (solo efectivo)
export function MontoRecibido({ total }: Props) {
  const [recibido, setRecibido] = useState('')

  const sugeridos = useMemo(() => sugerirMontos(total), [total])
  const monto = Number(recibido) || 0
  const vuelto = monto - total
  const falta = recibido !== '' && vuelto < 0

  return (
    <Box sx={{ bgcolor: 'action.hover', borderRadius: 2, p: 1.5 }}>
      {/* montos rapidos */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0.5, mb: 1.5 }}>
        {sugeridos.map((sugerido) => (
          <Button
            key={sugerido}
            size="small"
            variant={monto === sugerido ? 'contained' : 'outlined'}
            onClick={() => setRecibido(String(sugerido))}
            sx={{ fontFamily: 'monospace' }}
          >
            {formatoClp(sugerido)}
          </Button>
        ))}
        <Button size="small" variant="outlined" onClick={() => setRecibido(String(total))}>
          Exacto
        </Button>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
        {/* recibido */}
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
            MONTO RECIBIDO
          </Typography>
          <TextField
            size="small"
            value={recibido}
            onChange={(evento) => setRecibido(evento.target.value.replace(/\D/g, ''))}
            placeholder="0"
            slotProps={{
              input: {
                startAdornment: <InputAdornment position="start">$</InputAdornment>,
                sx: { fontFamily: 'monospace', fontWeight: 700, bgcolor: 'background.paper' },
              },
              htmlInput: { inputMode: 'numeric' },
            }}
          />
        </Box>

        {/* vuelto */}
        <Box>
          <Typography
            variant="caption"
            sx={{ fontWeight: 700, color: falta ? 'error.main' : 'success.main' }}
          >
            {falta ? 'FALTA' : 'VUELTO A ENTREGAR'}
          </Typography>
          <Box
            sx={{
              bgcolor: (theme) => alpha(falta ? theme.palette.error.main : theme.palette.success.main, 0.16),
              borderRadius: 1.5,
              px: 1.5,
              py: 0.9,
              textAlign: 'right',
            }}
          >
            <Typography sx={{ fontFamily: 'monospace', fontWeight: 700 }}>
              {recibido === '' ? '-' : formatoClp(Math.abs(vuelto))}
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}

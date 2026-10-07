// src/features/pos/components/visual/CalculadoraVuelto.tsx
import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { formatoClp } from '@/shared/utils/formatoClp'

type Props = {
  total: number
}

// billetes mas usados
const montosRapidos = [1000, 5000, 10000, 20000]

// calcular vuelto (solo en pantalla)
export function CalculadoraVuelto({ total }: Props) {
  const [recibido, setRecibido] = useState<number | null>(null)

  const vuelto = recibido === null ? 0 : recibido - total

  return (
    <Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 0.5 }}>
        {montosRapidos.map((monto) => (
          <Button key={monto} size="small" variant="outlined" onClick={() => setRecibido(monto)}>
            {formatoClp(monto)}
          </Button>
        ))}

        {/* pago justo */}
        <Button size="small" variant="outlined" onClick={() => setRecibido(total)}>
          Exacto
        </Button>
      </Box>

      {recibido !== null && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Paga con {formatoClp(recibido)}
          </Typography>
          <Typography
            variant="body2"
            sx={{ fontWeight: 700 }}
            color={vuelto < 0 ? 'error.main' : 'success.main'}
          >
            {vuelto < 0 ? `Faltan ${formatoClp(Math.abs(vuelto))}` : `Vuelto ${formatoClp(vuelto)}`}
          </Typography>
        </Box>
      )}
    </Box>
  )
}

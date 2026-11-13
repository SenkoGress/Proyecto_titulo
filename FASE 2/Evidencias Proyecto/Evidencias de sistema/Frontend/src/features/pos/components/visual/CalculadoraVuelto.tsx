// src/features/pos/components/visual/CalculadoraVuelto.tsx
import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import Typography from '@mui/material/Typography'
import BackspaceOutlinedIcon from '@mui/icons-material/BackspaceOutlined'
import { formatoClp } from '@/shared/utils/formatoClp'
import {
  BILLETES_Y_MONEDAS,
  calcularVuelto,
  desglosarVuelto,
} from '@/features/pos/utils/pagoEnEfectivo'

type Props = {
  total: number
}

// el cliente pasa billetes y monedas de a poco, asi que cada boton suma al monto recibido en vez
// de reemplazarlo: con 2.300 a pagar y 2.500 en la mano, antes no habia forma de anotarlo
export function CalculadoraVuelto({ total }: Props) {
  const [recibido, setRecibido] = useState(0)
  const [totalAnterior, setTotalAnterior] = useState(total)

  // si cambia el ticket, lo recibido ya no corresponde
  if (total !== totalAnterior) {
    setTotalAnterior(total)
    setRecibido(0)
  }

  const { vuelto, falta, alcanza } = calcularVuelto(recibido, total)
  const piezas = desglosarVuelto(vuelto)

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
        <TextField
          size="small"
          type="number"
          label="Paga con"
          value={recibido === 0 ? '' : recibido}
          onChange={(evento) => setRecibido(Math.max(0, Number(evento.target.value) || 0))}
          slotProps={{ input: { startAdornment: <InputAdornment position="start">$</InputAdornment> } }}
          sx={{ flexGrow: 1 }}
        />
        <Button size="small" variant="outlined" onClick={() => setRecibido(total)}>
          Exacto
        </Button>
        <Button
          size="small"
          color="error"
          aria-label="Borrar el monto recibido"
          disabled={recibido === 0}
          onClick={() => setRecibido(0)}
          sx={{ minWidth: 40 }}
        >
          <BackspaceOutlinedIcon fontSize="small" />
        </Button>
      </Box>

      {/* cada pieza se va sumando, como cuando el cliente las va pasando */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 0.5 }}>
        {BILLETES_Y_MONEDAS.map((valor) => (
          <Button
            key={valor}
            size="small"
            variant="outlined"
            onClick={() => setRecibido((previo) => previo + valor)}
            sx={{ px: 0.5, fontSize: 12 }}
          >
            {formatoClp(valor)}
          </Button>
        ))}
      </Box>

      {recibido > 0 && (
        <Box sx={{ mt: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" color="text.secondary">
              Recibido {formatoClp(recibido)}
            </Typography>
            <Typography
              variant="body2"
              sx={{ fontWeight: 700 }}
              color={alcanza ? 'success.main' : 'error.main'}
            >
              {alcanza ? `Vuelto ${formatoClp(vuelto)}` : `Faltan ${formatoClp(falta)}`}
            </Typography>
          </Box>

          {/* con que devolverlo, para no tener que pensarlo con el cliente al frente */}
          {piezas.length > 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              Entregar: {piezas.map((p) => `${p.cantidad} de ${formatoClp(p.valor)}`).join(', ')}
            </Typography>
          )}
        </Box>
      )}
    </Box>
  )
}

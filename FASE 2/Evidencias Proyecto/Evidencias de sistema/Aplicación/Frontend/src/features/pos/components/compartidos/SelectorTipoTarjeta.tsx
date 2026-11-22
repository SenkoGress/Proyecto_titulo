// src/features/pos/components/compartidos/SelectorTipoTarjeta.tsx
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import { useCarritoStore } from '@/features/pos/stores/carritoStore'
import { esConTarjeta } from '@/features/pos/utils/tipoTarjeta'
import type { TipoTarjeta } from '@/features/pos/types'

// credito o debito, para que despues la venta diga con que se cobro. Lo que el cajero elige aca
// vale solo si el terminal no informa el tipo; si lo informa, manda el terminal
export function SelectorTipoTarjeta() {
  const metodoPago = useCarritoStore((estado) => estado.metodoPago)
  const tipoTarjeta = useCarritoStore((estado) => estado.tipoTarjeta)
  const cambiarTipoTarjeta = useCarritoStore((estado) => estado.cambiarTipoTarjeta)

  if (!esConTarjeta(metodoPago)) return null

  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
        TIPO DE TARJETA
      </Typography>
      <ToggleButtonGroup
        exclusive
        fullWidth
        size="small"
        value={tipoTarjeta}
        onChange={(_evento, valor) => cambiarTipoTarjeta(valor as TipoTarjeta | null)}
        sx={{ mt: 0.5 }}
      >
        <ToggleButton value="DEBITO">Debito</ToggleButton>
        <ToggleButton value="CREDITO">Credito</ToggleButton>
      </ToggleButtonGroup>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
        {tipoTarjeta
          ? 'Queda anotado en la venta. Si la maquina informa otro tipo, se guarda el de la maquina.'
          : 'Puedes dejarlo sin marcar: la maquina lo informa cuando puede.'}
      </Typography>
    </Box>
  )
}

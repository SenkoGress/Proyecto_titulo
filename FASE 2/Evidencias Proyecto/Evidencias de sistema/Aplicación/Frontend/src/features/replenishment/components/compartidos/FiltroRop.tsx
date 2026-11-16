// src/features/proveedores/components/tecnico/FiltroRop.tsx
import { useState } from 'react'
import Button from '@mui/material/Button'
import Popover from '@mui/material/Popover'
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import TuneOutlined from '@mui/icons-material/TuneOutlined'
import { CONFIG_ROP_POR_DEFECTO } from '@/features/replenishment/types'
import type { ConfigRop } from '@/features/replenishment/types'

type Props = {
  config: ConfigRop
  onCambiar: (config: ConfigRop) => void
}

// ajusta los parametros del algoritmo rop
export function FiltroRop({ config, onCambiar }: Props) {
  const [ancla, setAncla] = useState<HTMLElement | null>(null)

  const esPorDefecto =
    config.analysisDays === CONFIG_ROP_POR_DEFECTO.analysisDays &&
    config.leadTimeDays === CONFIG_ROP_POR_DEFECTO.leadTimeDays &&
    config.safetyFactor === CONFIG_ROP_POR_DEFECTO.safetyFactor

  const cambiar = (campo: keyof ConfigRop, valor: string) => {
    const numero = Number(valor)
    if (Number.isNaN(numero) || numero <= 0) return
    onCambiar({ ...config, [campo]: numero })
  }

  return (
    <>
      <Button
        size="small"
        variant="outlined"
        startIcon={<TuneOutlined />}
        onClick={(evento) => setAncla(evento.currentTarget)}
        color={esPorDefecto ? 'primary' : 'warning'}
      >
        Filtro ROP {esPorDefecto ? '' : '(ajustado)'}
      </Button>

      <Popover
        open={Boolean(ancla)}
        anchorEl={ancla}
        onClose={() => setAncla(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Box sx={{ p: 2, width: 320, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Parametros del punto de reorden
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Se mandan tal cual a GET /replenishment/suggest.
            </Typography>
          </Box>

          <Divider />

          <TextField
            label="Dias de historial a analizar"
            type="number"
            size="small"
            value={config.analysisDays}
            onChange={(evento) => cambiar('analysisDays', evento.target.value)}
            helperText="Con cuantos dias de ventas se calcula la velocidad"
            fullWidth
          />

          <TextField
            label="Dias de entrega del proveedor"
            type="number"
            size="small"
            value={config.leadTimeDays}
            onChange={(evento) => cambiar('leadTimeDays', evento.target.value)}
            helperText="Cuanto demora en llegar el pedido"
            fullWidth
          />

          <TextField
            label="Factor de stock de seguridad"
            type="number"
            size="small"
            value={config.safetyFactor}
            onChange={(evento) => cambiar('safetyFactor', evento.target.value)}
            slotProps={{ htmlInput: { step: 0.1 } }}
            helperText="Colchon extra sobre el consumo estimado"
            fullWidth
          />

          <Button size="small" onClick={() => onCambiar(CONFIG_ROP_POR_DEFECTO)} disabled={esPorDefecto}>
            Volver a los valores por defecto
          </Button>
        </Box>
      </Popover>
    </>
  )
}

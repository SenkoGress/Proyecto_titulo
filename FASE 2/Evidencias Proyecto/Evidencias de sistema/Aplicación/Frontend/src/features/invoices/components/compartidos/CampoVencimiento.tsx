// src/features/invoices/components/compartidos/CampoVencimiento.tsx
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import { faltaVencimiento } from '@/features/invoices/utils/vencimientoFactura'
import type { ItemFactura } from '@/features/invoices/types'

type Props = {
  item: Pick<ItemFactura, 'fecha_vencimiento' | 'no_vence'>
  onCambiar: (cambios: Partial<ItemFactura>) => void
  estiloFecha?: React.CSSProperties
}

// D.S. 977/96: cada producto lleva su fecha de vencimiento, o la marca de que no vence
export function CampoVencimiento({ item, onCambiar, estiloFecha }: Props) {
  const noVence = item.no_vence === true

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <TextField
        type="date"
        value={noVence ? '' : (item.fecha_vencimiento ?? '')}
        size="small"
        variant="standard"
        disabled={noVence}
        error={faltaVencimiento(item)}
        onChange={(evento) => onCambiar({ fecha_vencimiento: evento.target.value || null })}
        slotProps={{
          htmlInput: { 'aria-label': 'Fecha de vencimiento', style: { fontSize: 13, width: 124, ...estiloFecha } },
        }}
      />

      <FormControlLabel
        sx={{ m: 0 }}
        slotProps={{ typography: { variant: 'caption' } }}
        label="No vence"
        control={
          <Checkbox
            size="small"
            checked={noVence}
            onChange={(_evento, marcado) =>
              onCambiar(marcado ? { no_vence: true, fecha_vencimiento: null } : { no_vence: false })
            }
            sx={{ p: 0.25 }}
          />
        }
      />
    </Box>
  )
}

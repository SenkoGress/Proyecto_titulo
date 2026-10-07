// src/features/pos/components/compartidos/VerificacionEdad.tsx
import Alert from '@mui/material/Alert'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import { useCarritoStore } from '@/features/pos/stores/carritoStore'

// ley 19.925: confirmar carnet antes de vender alcohol
export function VerificacionEdad() {
  const edadVerificada = useCarritoStore((estado) => estado.edadVerificada)
  const marcarEdadVerificada = useCarritoStore((estado) => estado.marcarEdadVerificada)

  return (
    <Alert severity="warning" sx={{ py: 0 }}>
      <FormControlLabel
        control={
          <Checkbox
            checked={edadVerificada}
            onChange={(evento) => marcarEdadVerificada(evento.target.checked)}
          />
        }
        label="Verifique la cedula, el cliente es mayor de 18 años"
      />
    </Alert>
  )
}

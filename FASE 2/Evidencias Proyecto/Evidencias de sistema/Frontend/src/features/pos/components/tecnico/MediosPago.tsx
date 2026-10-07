// src/features/pos/components/tecnico/MediosPago.tsx
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { useCarritoStore } from '@/features/pos/stores/carritoStore'
import { METODOS_PAGO } from '@/features/pos/metodosPago'

// medio de pago con tecla [1] a [5]
export function MediosPago() {
  const metodoPago = useCarritoStore((estado) => estado.metodoPago)
  const cambiarMetodoPago = useCarritoStore((estado) => estado.cambiarMetodoPago)

  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
        MEDIO DE PAGO PRINCIPAL
      </Typography>

      <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: '1fr 1fr', mt: 0.5 }}>
        {METODOS_PAGO.map((metodo, indice) => (
          <Button
            key={metodo.valor}
            variant={metodoPago === metodo.valor ? 'contained' : 'outlined'}
            startIcon={metodo.icono}
            onClick={() => cambiarMetodoPago(metodo.valor)}
            sx={{ justifyContent: 'flex-start' }}
          >
            {metodo.etiqueta} [{indice + 1}]
          </Button>
        ))}
      </Box>
    </Box>
  )
}

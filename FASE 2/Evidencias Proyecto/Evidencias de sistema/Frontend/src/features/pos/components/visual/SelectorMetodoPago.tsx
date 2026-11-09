// src/features/pos/components/visual/SelectorMetodoPago.tsx
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { Ayuda } from '@/shared/components/ui/Ayuda'
import { useCarritoStore } from '@/features/pos/stores/carritoStore'
import { METODOS_PAGO } from '@/features/pos/metodosPago'

// elegir medio de pago
export function SelectorMetodoPago() {
  const metodoPago = useCarritoStore((estado) => estado.metodoPago)
  const cambiarMetodoPago = useCarritoStore((estado) => estado.cambiarMetodoPago)

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
          METODO DE PAGO
        </Typography>
        <Ayuda texto="Con efectivo el total se redondea a la decena (Ley 20.956) y se emite boleta. Con tarjeta se cobra el monto exacto y el comprobante es el voucher, no una boleta." />
      </Box>

      <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: '1fr 1fr', mt: 0.5 }}>
        {METODOS_PAGO.map((metodo) => (
          <Button
            key={metodo.valor}
            variant={metodoPago === metodo.valor ? 'contained' : 'outlined'}
            startIcon={metodo.icono}
            onClick={() => cambiarMetodoPago(metodo.valor)}
            sx={{ justifyContent: 'flex-start' }}
          >
            {metodo.etiqueta}
          </Button>
        ))}
      </Box>
    </Box>
  )
}

// src/features/sii/components/compartidos/TarjetasResumenCompras.tsx
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'
import { formatoClp } from '@/shared/utils/formatoClp'
import type { ResumenCompras } from '@/features/sii/utils/resumenCompras'

type Color = 'primary.main' | 'info.main' | 'success.main' | 'text.primary'

type Props = {
  resumen: ResumenCompras
}

function Tarjeta({
  titulo,
  valor,
  color,
  ayuda,
}: {
  titulo: string
  valor: string
  color: Color
  ayuda: string
}) {
  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Tooltip title={ayuda}>
        <Typography
          variant="caption"
          sx={{ fontWeight: 700, letterSpacing: 0.5, color: 'text.secondary', cursor: 'help' }}
        >
          {titulo.toUpperCase()}
        </Typography>
      </Tooltip>

      <Typography variant="h4" sx={{ fontWeight: 700, color, mt: 0.5 }}>
        {valor}
      </Typography>
    </Paper>
  )
}

// los 4 totales de las facturas de compra
export function TarjetasResumenCompras({ resumen }: Props) {
  return (
    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))' }}>
      <Tarjeta
        titulo="Facturas respaldadas"
        valor={String(resumen.cantidad)}
        color="text.primary"
        ayuda="Facturas de compra ingresadas al sistema"
      />

      <Tarjeta
        titulo="Total neto compras"
        valor={formatoClp(resumen.neto)}
        color="text.primary"
        ayuda="Monto de las compras sin IVA"
      />

      <Tarjeta
        titulo="IVA credito fiscal (19%)"
        valor={formatoClp(resumen.ivaCredito)}
        color="info.main"
        ayuda="El IVA que pagaste al comprar y que puedes descontar de lo que debes declarar"
      />

      <Tarjeta
        titulo="Total compras bruto"
        valor={formatoClp(resumen.bruto)}
        color="success.main"
        ayuda="Lo que efectivamente pagaste a los proveedores, con IVA incluido"
      />
    </Box>
  )
}

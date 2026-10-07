// src/features/inventario/components/BarraStock.tsx
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import LinearProgress from '@mui/material/LinearProgress'
import type { ProductoInventario } from '@/features/inventario/types'
import { estadoStock } from '@/features/inventario/utils/calculosInventario'

type Props = {
  producto: ProductoInventario
}

const colorPorEstado = {
  'sin-stock': 'error',
  bajo: 'warning',
  normal: 'success',
} as const

// barra chica: stock actual vs minimo, coloreada segun que tan critico esta
export function BarraStock({ producto }: Props) {
  const estado = estadoStock(producto)
  // referencia visual: el doble del minimo se pinta como "lleno"
  const tope = Math.max(producto.stock_minimo * 2, 1)
  const porcentaje = Math.min(100, (producto.stock_actual / tope) * 100)

  return (
    <Box sx={{ width: '100%' }}>
      <Typography
        variant="body2"
        sx={{ fontWeight: 700, color: estado === 'normal' ? 'text.primary' : `${colorPorEstado[estado]}.main` }}
      >
        {producto.stock_actual} un.
      </Typography>
      <LinearProgress
        variant="determinate"
        value={porcentaje}
        color={colorPorEstado[estado]}
        sx={{ height: 5, borderRadius: 5, mt: 0.25 }}
      />
      <Typography variant="caption" color="text.secondary">
        Min: {producto.stock_minimo}
      </Typography>
    </Box>
  )
}

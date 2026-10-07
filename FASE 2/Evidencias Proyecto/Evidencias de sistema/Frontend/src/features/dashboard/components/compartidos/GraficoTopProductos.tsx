// src/features/dashboard/components/compartidos/GraficoTopProductos.tsx
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { BarChart } from '@mui/x-charts/BarChart'
import EmojiEventsOutlined from '@mui/icons-material/EmojiEventsOutlined'
import type { ProductoTop } from '@/features/dashboard/types'

type Props = {
  productos: ProductoTop[]
}

// nombres largos no caben en el eje
function acortar(nombre: string): string {
  return nombre.length > 16 ? `${nombre.slice(0, 15)}…` : nombre
}

// productos con mas rotacion del periodo
export function GraficoTopProductos({ productos }: Props) {
  return (
    <Paper variant="outlined" sx={{ p: 2.5, height: '100%' }}>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
        <EmojiEventsOutlined color="primary" />
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Productos mas vendidos
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
          En unidades
        </Typography>
      </Box>

      {productos.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 8, textAlign: 'center' }}>
          Sin ventas en este periodo.
        </Typography>
      ) : (
        <BarChart
          height={260}
          xAxis={[{ data: productos.map((producto) => acortar(producto.nombre)), scaleType: 'band' }]}
          series={[
            {
              data: productos.map((producto) => producto.unidades),
              label: 'Unidades',
              valueFormatter: (valor) => `${valor ?? 0} un`,
            },
          ]}
          margin={{ left: 50 }}
        />
      )}
    </Paper>
  )
}

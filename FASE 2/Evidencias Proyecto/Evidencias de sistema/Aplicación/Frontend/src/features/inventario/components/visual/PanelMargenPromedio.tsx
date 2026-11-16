// src/features/inventario/components/PanelMargenPromedio.tsx
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'

type Props = {
  margenPromedio: number
}

// margen promedio real, calculado de costo vs venta de todo el catalogo actual
export function PanelMargenPromedio({ margenPromedio }: Props) {
  return (
    <Paper variant="outlined" sx={{ p: 2, display: 'flex', gap: 1.5, alignItems: 'center' }}>
      <TrendingUpIcon color="success" />
      <Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          Margen promedio tienda
        </Typography>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          {margenPromedio.toFixed(1)}%
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Promedio simple sobre el catalogo activo (costo vs. venta)
        </Typography>
      </Box>
    </Paper>
  )
}

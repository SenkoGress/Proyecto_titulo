// src/features/dashboard/components/compartidos/DesglosePorCategoria.tsx
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import LinearProgress from '@mui/material/LinearProgress'
import CategoryOutlined from '@mui/icons-material/CategoryOutlined'
import { formatoClp } from '@/shared/utils/formatoClp'
import type { CategoriaDashboard } from '@/features/dashboard/types'

type Props = {
  categorias: CategoriaDashboard[]
}

// que rubro esta moviendo la venta
export function DesglosePorCategoria({ categorias }: Props) {
  const total = categorias.reduce((suma, categoria) => suma + categoria.total, 0)

  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1.5 }}>
        <CategoryOutlined color="primary" />
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Ventas por categoria
        </Typography>
      </Box>

      {categorias.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Sin ventas en este periodo.
        </Typography>
      ) : (
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
          {categorias.map((categoria) => {
            const porcentaje = total > 0 ? Math.round((categoria.total / total) * 100) : 0

            return (
              <Box key={categoria.categoria}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {categoria.categoria}
                  </Typography>
                  <Typography variant="body2">{formatoClp(categoria.total)}</Typography>
                </Box>

                <LinearProgress
                  variant="determinate"
                  value={porcentaje}
                  sx={{ my: 0.5, height: 6, borderRadius: 3 }}
                />

                <Typography variant="caption" color="text.secondary">
                  {categoria.unidades} unidades · {porcentaje}% de la venta
                </Typography>
              </Box>
            )
          })}
        </Box>
      )}
    </Paper>
  )
}

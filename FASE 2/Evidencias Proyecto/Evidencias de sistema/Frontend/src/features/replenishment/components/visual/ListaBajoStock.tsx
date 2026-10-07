// src/features/replenishment/components/visual/ListaBajoStock.tsx
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import LinearProgress from '@mui/material/LinearProgress'
import Divider from '@mui/material/Divider'
import Skeleton from '@mui/material/Skeleton'
import { alpha, useTheme } from '@mui/material/styles'
import ErrorOutlineOutlined from '@mui/icons-material/ErrorOutlineOutlined'
import { tiempoHastaQuiebre } from '@/features/replenishment/utils/detalleRop'
import type { FilaRop } from '@/features/replenishment/utils/detalleRop'

type Props = {
  filas: FilaRop[]
  cargando: boolean
}

// productos que se estan acabando, en lenguaje simple
export function ListaBajoStock({ filas, cargando }: Props) {
  const theme = useTheme()

  if (cargando) return <Skeleton variant="rounded" height={280} />

  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', mb: 2 }}>
        <Box
          sx={{
            display: 'flex',
            p: 1,
            borderRadius: 2,
            bgcolor: alpha(theme.palette.error.main, 0.12),
            color: 'error.main',
          }}
        >
          <ErrorOutlineOutlined />
        </Box>

        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Productos que se estan acabando
          </Typography>
          <Typography variant="body2" color="text.secondary">
            El sistema mira cuanto vendes de cada uno y avisa antes de que se acabe.
          </Typography>
        </Box>
      </Box>

      {filas.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          Ningun producto necesita reposicion por ahora.
        </Typography>
      )}

      {filas.map((fila, indice) => {
        const agotado = fila.severidad === 'AGOTADO'
        const cobertura = fila.stock_minimo > 0 ? Math.min(100, (fila.stock_actual / fila.stock_minimo) * 100) : 100

        return (
          <Box key={fila.producto_id}>
            {indice > 0 && <Divider sx={{ my: 1.5 }} />}

            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              <Box sx={{ flex: '1 1 220px', minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {fila.nombre}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {fila.proveedor_nombre ?? 'Sin proveedor asignado'} · {fila.proxima_visita.displayText}
                </Typography>
              </Box>

              <Box sx={{ flex: '1 1 160px', minWidth: 0 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="caption" color="text.secondary">
                    Quedan {fila.stock_actual}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    minimo {fila.stock_minimo}
                  </Typography>
                </Box>

                <LinearProgress
                  variant="determinate"
                  value={cobertura}
                  color={agotado ? 'error' : 'warning'}
                  sx={{ mt: 0.5, height: 6, borderRadius: 3 }}
                />
              </Box>

              <Box sx={{ textAlign: 'right', minWidth: 120 }}>
                <Chip
                  label={agotado ? 'SIN STOCK' : 'POR ACABARSE'}
                  size="small"
                  color={agotado ? 'error' : 'warning'}
                  sx={{ fontWeight: 700 }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                  {fila.dias_inventario_restante >= 999
                    ? 'sin ventas recientes'
                    : `se acaba ${tiempoHastaQuiebre(fila.dias_inventario_restante)}`}
                </Typography>
              </Box>
            </Box>
          </Box>
        )
      })}
    </Paper>
  )
}

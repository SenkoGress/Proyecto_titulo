// src/features/dashboard/components/visual/PanelSugerencias.tsx
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Skeleton from '@mui/material/Skeleton'
import LightbulbOutlined from '@mui/icons-material/LightbulbOutlined'
import { armarSugerencias } from '@/features/dashboard/utils/sugerencias'
import type { Sugerencia } from '@/features/dashboard/utils/sugerencias'
import type { ProductoVencimiento } from '@/features/inventario/types'
import type { VelocidadProducto } from '@/features/replenishment/types'

type Props = {
  velocidades: VelocidadProducto[]
  vencimientos: ProductoVencimiento[]
  cargando: boolean
}

const ETIQUETA = {
  rotacion: { texto: 'Rotacion', color: 'warning' },
  vencimiento: { texto: 'Por vencer', color: 'error' },
} as const

function Fila({ sugerencia }: { sugerencia: Sugerencia }) {
  const etiqueta = ETIQUETA[sugerencia.tipo]

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1 }}>
      <Chip size="small" label={etiqueta.texto} color={etiqueta.color} sx={{ minWidth: 72 }} />
      <Box sx={{ minWidth: 0, flexGrow: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
          {sugerencia.nombre}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {sugerencia.motivo}
        </Typography>
      </Box>
    </Box>
  )
}

// sugerencias de promocion sobre datos propios: rotacion y vencimiento proximo
export function PanelSugerencias({ velocidades, vencimientos, cargando }: Props) {
  const sugerencias = armarSugerencias(velocidades, vencimientos)

  return (
    <Paper variant="outlined" sx={{ p: 2.5, height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <LightbulbOutlined color="action" />
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Sugerencias de promocion
        </Typography>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Calculadas sobre las ventas de los ultimos 30 dias y las fechas de vencimiento cargadas.
      </Typography>

      <Divider />

      {cargando && <Skeleton variant="rounded" height={180} sx={{ mt: 1.5 }} />}

      {!cargando && sugerencias.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Nada urgente por ahora: ningun producto en rotacion esta bajo su punto de reorden y ninguno
          vence dentro de 30 dias con stock disponible.
        </Typography>
      )}

      {!cargando &&
        sugerencias.map((sugerencia) => <Fila key={sugerencia.id} sugerencia={sugerencia} />)}
    </Paper>
  )
}

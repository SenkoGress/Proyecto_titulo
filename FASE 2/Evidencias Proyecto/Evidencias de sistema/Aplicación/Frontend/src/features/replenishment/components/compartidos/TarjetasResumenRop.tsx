// src/features/replenishment/components/compartidos/TarjetasResumenRop.tsx
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'
import { alpha, useTheme } from '@mui/material/styles'
import ShoppingCartOutlined from '@mui/icons-material/ShoppingCartOutlined'
import WarningAmberOutlined from '@mui/icons-material/WarningAmberOutlined'
import ScheduleOutlined from '@mui/icons-material/ScheduleOutlined'
import PaidOutlined from '@mui/icons-material/PaidOutlined'
import { formatoClp } from '@/shared/utils/formatoClp'
import type { ConfigRop, ResumenReabastecimiento } from '@/features/replenishment/types'

type Color = 'primary' | 'error' | 'info' | 'success'

type Props = {
  resumen: ResumenReabastecimiento | undefined
  config: ConfigRop
  tecnico: boolean
}

function Tarjeta({
  titulo,
  valor,
  pie,
  icono,
  color,
  ayuda,
}: {
  titulo: string
  valor: string
  pie: string
  icono: React.ReactNode
  color: Color
  ayuda: string
}) {
  const theme = useTheme()

  return (
    <Paper variant="outlined" sx={{ p: 2.5, display: 'flex', gap: 2, alignItems: 'flex-start' }}>
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Tooltip title={ayuda}>
          <Typography
            variant="caption"
            sx={{ fontWeight: 700, letterSpacing: 0.5, color: 'text.secondary', cursor: 'help' }}
          >
            {titulo.toUpperCase()}
          </Typography>
        </Tooltip>

        <Typography variant="h4" sx={{ fontWeight: 700, color: `${color}.main`, my: 0.25 }}>
          {valor}
        </Typography>

        <Typography variant="caption" color="text.secondary">
          {pie}
        </Typography>
      </Box>

      <Box
        sx={{
          display: 'flex',
          p: 1.25,
          borderRadius: 2,
          bgcolor: alpha(theme.palette[color].main, 0.12),
          color: `${color}.main`,
        }}
      >
        {icono}
      </Box>
    </Paper>
  )
}

// los indicadores del motor de reposicion
export function TarjetasResumenRop({ resumen, config, tecnico }: Props) {
  return (
    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))' }}>
      <Tarjeta
        titulo={tecnico ? 'Ordenes sugeridas' : 'Pedidos por hacer'}
        valor={String(resumen?.total_ordenes ?? 0)}
        pie="Una por proveedor"
        icono={<ShoppingCartOutlined />}
        color="primary"
        ayuda="El sistema agrupa los productos por el proveedor que los surte"
      />

      <Tarjeta
        titulo={tecnico ? 'Productos en riesgo critico' : 'Productos por acabarse'}
        valor={String(resumen?.total_productos_criticos ?? 0)}
        pie="Bajo el minimo o agotados"
        icono={<WarningAmberOutlined />}
        color="error"
        ayuda="Productos que llegaron a su punto de reorden"
      />

      <Tarjeta
        titulo={tecnico ? 'Costo total estimado' : 'Lo que cuesta reponer'}
        valor={formatoClp(resumen?.costo_total_estimado ?? 0)}
        pie="Si se pide todo lo sugerido"
        icono={<PaidOutlined />}
        color="success"
        ayuda="Suma de todas las ordenes propuestas, al precio de compra"
      />

      <Tarjeta
        titulo={tecnico ? 'Tiempo de reposicion' : 'Demora el pedido'}
        valor={`${config.leadTimeDays} dias`}
        pie={`Historial ${config.analysisDays}d · factor ${config.safetyFactor}x`}
        icono={<ScheduleOutlined />}
        color="info"
        ayuda="Cuanto demora en llegar el pedido, y con cuantos dias de venta se calcula la rotacion"
      />
    </Box>
  )
}

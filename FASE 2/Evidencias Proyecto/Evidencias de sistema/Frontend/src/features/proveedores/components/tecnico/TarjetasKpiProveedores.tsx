// src/features/proveedores/components/tecnico/TarjetasKpiProveedores.tsx
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import { alpha, useTheme } from '@mui/material/styles'
import StorefrontOutlined from '@mui/icons-material/StorefrontOutlined'
import BoltOutlined from '@mui/icons-material/BoltOutlined'
import ReceiptLongOutlined from '@mui/icons-material/ReceiptLongOutlined'
import CalendarMonthOutlined from '@mui/icons-material/CalendarMonthOutlined'
import { formatoClp } from '@/shared/utils/formatoClp'
import type { ResumenReabastecimiento } from '@/features/replenishment/types'
import type { MetricasProveedores } from '@/features/proveedores/utils/metricasProveedores'

type Color = 'primary' | 'warning' | 'success' | 'info'

type Props = {
  metricas: MetricasProveedores
  resumenRop: ResumenReabastecimiento | undefined
}

// una tarjeta de indicador
function Kpi({
  titulo,
  valor,
  unidad,
  icono,
  color,
  pie,
}: {
  titulo: string
  valor: string | number
  unidad: string
  icono: React.ReactNode
  color: Color
  pie: React.ReactNode
}) {
  const theme = useTheme()

  return (
    <Paper variant="outlined" sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1, height: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
        <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 0.5, color: 'text.secondary' }}>
          {titulo.toUpperCase()}
        </Typography>

        <Box
          sx={{
            display: 'flex',
            p: 0.75,
            borderRadius: 1.5,
            bgcolor: alpha(theme.palette[color].main, 0.12),
            color: `${color}.main`,
          }}
        >
          {icono}
        </Box>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, lineHeight: 1 }}>
          {valor}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {unidad}
        </Typography>
      </Box>

      <Box sx={{ mt: 'auto' }}>{pie}</Box>
    </Paper>
  )
}

// indicadores superiores del modo tecnico, todos con datos reales del backend
export function TarjetasKpiProveedores({ metricas, resumenRop }: Props) {
  return (
    <Box
      sx={{
        display: 'grid',
        gap: 2,
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
      }}
    >
      <Kpi
        titulo="Proveedores registrados"
        valor={metricas.total}
        unidad="en el catalogo"
        icono={<StorefrontOutlined fontSize="small" />}
        color="primary"
        pie={
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            <Chip label={`${metricas.conProductos} con productos`} size="small" variant="outlined" />
            {metricas.sinProductos > 0 && (
              <Chip label={`${metricas.sinProductos} sin productos`} size="small" variant="outlined" color="warning" />
            )}
          </Box>
        }
      />

      <Kpi
        titulo="Disparadores ROP"
        valor={resumenRop?.total_productos_criticos ?? 0}
        unidad="bajo punto de reorden"
        icono={<BoltOutlined fontSize="small" />}
        color="warning"
        pie={
          <Typography variant="caption" color="text.secondary">
            {resumenRop?.total_ordenes ?? 0} ordenes sugeridas · {formatoClp(resumenRop?.costo_total_estimado ?? 0)}{' '}
            estimado
          </Typography>
        }
      />

      <Kpi
        titulo="Facturas procesadas"
        valor={metricas.totalFacturas}
        unidad="ingresos OCR"
        icono={<ReceiptLongOutlined fontSize="small" />}
        color="success"
        pie={
          <Typography variant="caption" color="text.secondary">
            {formatoClp(metricas.montoComprado)} comprado · {metricas.facturasOcrReal} con IA real
          </Typography>
        }
      />

      <Kpi
        titulo="Visitas programadas"
        valor={metricas.visitanHoy}
        unidad="llegan hoy"
        icono={<CalendarMonthOutlined fontSize="small" />}
        color="info"
        pie={
          <Typography variant="caption" color="text.secondary">
            {metricas.visitanEstaSemana} proveedores dentro de los proximos 7 dias
          </Typography>
        }
      />
    </Box>
  )
}

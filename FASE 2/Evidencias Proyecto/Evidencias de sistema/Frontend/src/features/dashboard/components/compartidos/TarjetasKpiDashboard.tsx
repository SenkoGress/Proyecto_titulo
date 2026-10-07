// src/features/dashboard/components/compartidos/TarjetasKpiDashboard.tsx
import { Link as RouterLink } from 'react-router'
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'
import Link from '@mui/material/Link'
import { alpha, useTheme } from '@mui/material/styles'
import PointOfSaleOutlined from '@mui/icons-material/PointOfSaleOutlined'
import TrendingUpOutlined from '@mui/icons-material/TrendingUpOutlined'
import ReceiptOutlined from '@mui/icons-material/ReceiptOutlined'
import ShoppingBasketOutlined from '@mui/icons-material/ShoppingBasketOutlined'
import Inventory2Outlined from '@mui/icons-material/Inventory2Outlined'
import WarningAmberOutlined from '@mui/icons-material/WarningAmberOutlined'
import { formatoClp } from '@/shared/utils/formatoClp'
import type { KpisDashboard } from '@/features/dashboard/types'

type Color = 'primary' | 'success' | 'warning' | 'info' | 'secondary' | 'error'

type Props = {
  kpis: KpisDashboard
  etiquetaPeriodo: string
  tecnico: boolean
}

function Tarjeta({
  titulo,
  valor,
  unidad,
  pie,
  icono,
  color,
  ayuda,
}: {
  titulo: string
  valor: string
  unidad: string
  pie: React.ReactNode
  icono: React.ReactNode
  color: Color
  ayuda: string
}) {
  const theme = useTheme()

  return (
    <Paper
      variant="outlined"
      sx={{ p: 2, display: 'flex', gap: 1.5, alignItems: 'flex-start', borderTop: 3, borderTopColor: `${color}.main` }}
    >
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Tooltip title={ayuda}>
          <Typography
            variant="caption"
            sx={{ fontWeight: 700, letterSpacing: 0.5, color: 'text.secondary', cursor: 'help' }}
          >
            {titulo.toUpperCase()}
          </Typography>
        </Tooltip>

        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, my: 0.5 }}>
          <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1, color: `${color}.main` }}>
            {valor}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {unidad}
          </Typography>
        </Box>

        {pie}
      </Box>

      <Box
        sx={{
          display: 'flex',
          p: 1,
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

function Pie({ children }: { children: React.ReactNode }) {
  return (
    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
      {children}
    </Typography>
  )
}

// los 6 indicadores del periodo, con el vocabulario de cada modo
export function TarjetasKpiDashboard({ kpis, etiquetaPeriodo, tecnico }: Props) {
  const potencial = kpis.inventarioValorVenta - kpis.inventarioValorCosto
  const enRiesgo = kpis.productosStockCritico + kpis.productosAgotados

  return (
    <Box
      sx={{
        display: 'grid',
        gap: 2,
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
      }}
    >
      <Tarjeta
        titulo={tecnico ? `Ventas brutas ${etiquetaPeriodo}` : `Ventas ${etiquetaPeriodo}`}
        valor={formatoClp(kpis.totalVentasBruto)}
        unidad="CLP"
        icono={<PointOfSaleOutlined />}
        color="primary"
        ayuda="Total facturado en el periodo, con su desglose tributario"
        pie={
          <Pie>
            Neto {formatoClp(kpis.totalVentasNeto)} · IVA {formatoClp(kpis.totalIvaDebito)}
          </Pie>
        }
      />

      <Tarjeta
        titulo={tecnico ? 'Utilidad bruta' : 'Ganancia estimada'}
        valor={formatoClp(kpis.utilidadBruta)}
        unidad={`${kpis.margenUtilidadPorc}% margen`}
        icono={<TrendingUpOutlined />}
        color="success"
        ayuda="Venta neta menos el costo de lo vendido, segun el precio de compra de cada producto"
        pie={<Pie>Costo vendido {formatoClp(kpis.costoTotalVendido)}</Pie>}
      />

      <Tarjeta
        titulo="Ticket promedio"
        valor={formatoClp(kpis.ticketPromedio)}
        unidad="por venta"
        icono={<ReceiptOutlined />}
        color="warning"
        ayuda="Cuanto gasta en promedio cada cliente en el periodo"
        pie={<Pie>{kpis.totalTransacciones} transacciones</Pie>}
      />

      <Tarjeta
        titulo={tecnico ? 'Unidades vendidas' : 'Productos vendidos'}
        valor={String(kpis.unidadesVendidas)}
        unidad="unidades"
        icono={<ShoppingBasketOutlined />}
        color="secondary"
        ayuda="Suma de las cantidades de todas las lineas vendidas"
        pie={<Pie>Articulos despachados</Pie>}
      />

      <Tarjeta
        titulo={tecnico ? 'Inventario valorizado' : 'Valor del inventario'}
        valor={formatoClp(kpis.inventarioValorCosto)}
        unidad="a costo"
        icono={<Inventory2Outlined />}
        color="info"
        ayuda="Cuanta plata hay inmovilizada en stock y cuanto rendiria vendido"
        pie={
          <Pie>
            A venta {formatoClp(kpis.inventarioValorVenta)} · potencial {formatoClp(potencial)}
          </Pie>
        }
      />

      <Tarjeta
        titulo="Salud del stock"
        valor={`${kpis.productosStockCritico} crit.`}
        unidad={`${kpis.productosAgotados} agotados`}
        icono={<WarningAmberOutlined />}
        color={enRiesgo > 0 ? 'error' : 'success'}
        ayuda="Productos bajo su minimo y productos sin stock, contados por el backend"
        pie={
          <Pie>
            {kpis.totalProveedores} proveedores ·{' '}
            <Link component={RouterLink} to="/notificaciones" underline="hover">
              ver avisos
            </Link>
          </Pie>
        }
      />
    </Box>
  )
}

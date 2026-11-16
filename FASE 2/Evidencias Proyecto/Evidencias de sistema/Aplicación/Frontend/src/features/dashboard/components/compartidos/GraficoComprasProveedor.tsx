// src/features/dashboard/components/compartidos/GraficoComprasProveedor.tsx
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import { BarChart } from '@mui/x-charts/BarChart'
import LocalShippingOutlined from '@mui/icons-material/LocalShippingOutlined'
import { formatoClp, formatoClpCorto } from '@/shared/utils/formatoClp'
import type { ProveedorDashboard } from '@/features/dashboard/types'

type Props = {
  proveedores: ProveedorDashboard[]
}

function acortar(nombre: string): string {
  return nombre.length > 16 ? `${nombre.slice(0, 15)}…` : nombre
}

// cuanto se le compro a cada proveedor, segun las facturas ya ingresadas
export function GraficoComprasProveedor({ proveedores }: Props) {
  const theme = useTheme()
  const conCompras = proveedores.filter((proveedor) => proveedor.totalInvertido > 0)

  return (
    <Paper variant="outlined" sx={{ p: 2.5, height: '100%' }}>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
        <LocalShippingOutlined color="primary" />
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Compras por proveedor
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
          Facturas ingresadas
        </Typography>
      </Box>

      {conCompras.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 8, textAlign: 'center' }}>
          Todavia no hay facturas de compra ingresadas.
        </Typography>
      ) : (
        <BarChart
          height={260}
          xAxis={[{ data: conCompras.map((proveedor) => acortar(proveedor.nombre)), scaleType: 'band' }]}
          yAxis={[{ valueFormatter: (valor: number) => formatoClpCorto(valor) }]}
          series={[
            {
              data: conCompras.map((proveedor) => proveedor.totalInvertido),
              label: 'Comprado',
              valueFormatter: (valor) => formatoClp(valor ?? 0),
              color: theme.palette.info.main,
            },
          ]}
          margin={{ left: 55 }}
        />
      )}
    </Paper>
  )
}

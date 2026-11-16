// src/features/inventario/components/TarjetasResumenInventario.tsx
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'
import Inventory2Icon from '@mui/icons-material/Inventory2'
import PaidIcon from '@mui/icons-material/Paid'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import RemoveShoppingCartIcon from '@mui/icons-material/RemoveShoppingCart'
import { formatoClp } from '@/shared/utils/formatoClp'
import type { ResumenInventario } from '@/features/inventario/utils/calculosInventario'

type Props = {
  resumen: ResumenInventario
}

type ColorTarjeta = 'primary' | 'success' | 'warning' | 'error'

// una tarjeta con un numero grande
function Tarjeta({
  icono,
  color,
  etiqueta,
  valor,
  detalle,
}: {
  icono: React.ReactNode
  color: ColorTarjeta
  etiqueta: string
  valor: string
  detalle?: string
}) {
  return (
    <Paper variant="outlined" sx={{ p: 2, display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
      <Box
        sx={{
          // fondo suave del color del icono
          bgcolor: (tema) => alpha(tema.palette[color].main, 0.12),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 36,
          height: 36,
          borderRadius: 2,
        }}
      >
        {icono}
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary">
          {etiqueta}
        </Typography>
        <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
          {valor}
        </Typography>
        {detalle && (
          <Typography variant="caption" color="text.secondary">
            {detalle}
          </Typography>
        )}
      </Box>
    </Paper>
  )
}

// las 4 tarjetas de arriba, todas calculadas de los productos reales
export function TarjetasResumenInventario({ resumen }: Props) {
  return (
    <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' } }}>
      <Tarjeta
        icono={<Inventory2Icon color="primary" />}
        color="primary"
        etiqueta="Total productos"
        valor={String(resumen.totalProductos)}
        detalle="SKUs activos"
      />
      <Tarjeta
        icono={<PaidIcon color="success" />}
        color="success"
        etiqueta="Valor inventario (venta)"
        valor={formatoClp(resumen.valorVenta)}
        detalle={`Costo base: ${formatoClp(resumen.costoBase)}`}
      />
      <Tarjeta
        icono={<WarningAmberIcon color="warning" />}
        color="warning"
        etiqueta="Bajo stock minimo"
        valor={String(resumen.bajoStock)}
        detalle="Requiere reposicion"
      />
      <Tarjeta
        icono={<RemoveShoppingCartIcon color="error" />}
        color="error"
        etiqueta="Sin stock"
        valor={String(resumen.sinStock)}
        detalle="Productos agotados"
      />
    </Box>
  )
}

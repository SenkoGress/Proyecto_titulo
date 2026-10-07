// src/features/dashboard/components/visual/UltimasTransacciones.tsx
import { Link } from 'react-router'
import Paper from '@mui/material/Paper'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Skeleton from '@mui/material/Skeleton'
import Tooltip from '@mui/material/Tooltip'
import HistoryOutlined from '@mui/icons-material/HistoryOutlined'
import { formatoClp } from '@/shared/utils/formatoClp'
import { fechaHoraCorta, haceCuanto } from '@/features/dashboard/utils/tiempoRelativo'
import type { Transaccion } from '@/features/ventas/types'

type Props = {
  transacciones: Transaccion[]
  cargando: boolean
}

const CUANTAS_MOSTRAR = 5

// resume los productos de la venta: "Coca Cola +2 mas"
function resumenItems(venta: Transaccion): string {
  if (venta.items.length === 0) return `${venta.unidades} unidades`
  if (venta.items.length === 1) return venta.items[0].producto_nombre
  return `${venta.items[0].producto_nombre} +${venta.items.length - 1} mas`
}

// ultimas ventas registradas en el sistema
export function UltimasTransacciones({ transacciones, cargando }: Props) {
  const ultimas = transacciones.slice(0, CUANTAS_MOSTRAR)

  return (
    <Paper variant="outlined" sx={{ p: 2.5, height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <HistoryOutlined color="action" />
        <Typography variant="h6" sx={{ fontWeight: 700, flexGrow: 1 }}>
          Ultimas ventas
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {transacciones.length} en total
        </Typography>
      </Box>

      {cargando && <Skeleton variant="rounded" height={200} />}

      {!cargando && ultimas.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          Todavia no hay ventas registradas.
        </Typography>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        {ultimas.map((venta, indice) => (
          <Box key={venta.id}>
            {indice > 0 && <Divider />}

            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', py: 1.25 }}>
              <Tooltip title={`Folio ${venta.folio}`}>
                <Chip label={fechaHoraCorta(venta.fecha)} size="small" variant="outlined" sx={{ flexShrink: 0 }} />
              </Tooltip>

              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                  {resumenItems(venta)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {haceCuanto(venta.fecha)} · {venta.unidades} un · {venta.cajero_nombre}
                </Typography>
              </Box>

              <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {formatoClp(venta.total)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {venta.medio_pago_tipo}
                </Typography>
              </Box>
            </Box>
          </Box>
        ))}
      </Box>

      <Button component={Link} to="/ventas" size="small" sx={{ mt: 1 }}>
        Ver todas las ventas
      </Button>
    </Paper>
  )
}

// src/features/proveedores/components/tecnico/PanelRegistroRop.tsx
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import { alpha, useTheme } from '@mui/material/styles'
import BoltOutlined from '@mui/icons-material/BoltOutlined'
import { formatoClp } from '@/shared/utils/formatoClp'
import type { ItemOrdenSugerida, OrdenSugerida } from '@/features/replenishment/types'

type Props = {
  ordenes: OrdenSugerida[]
  cargando: boolean
}

// una linea disparada: que producto lo gatillo y con que numeros
function Disparo({ item }: { item: ItemOrdenSugerida }) {
  return (
    <Box sx={{ mt: 0.75 }}>
      <Typography variant="caption" sx={{ display: 'block' }}>
        <strong>{item.producto_nombre}</strong>
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
        Stock {item.stock_actual} · minimo {item.stock_minimo} · pedir {item.cantidad_sugerida} un ·{' '}
        {formatoClp(item.costo_estimado)}
      </Typography>

      {item.candidatos_proveedores.length > 1 && (
        <Tooltip
          title={item.candidatos_proveedores
            .map((c) => `${c.proveedor_nombre}: ${formatoClp(c.precio_unitario)} (${c.proxima_visita.displayText})`)
            .join(' · ')}
        >
          <Typography variant="caption" color="primary" sx={{ display: 'block', cursor: 'help' }}>
            {item.candidatos_proveedores.length} proveedores lo venden
          </Typography>
        </Tooltip>
      )}
    </Box>
  )
}

// registro de disparos del punto de reorden (lo calcula el algoritmo rop del backend)
export function PanelRegistroRop({ ordenes, cargando }: Props) {
  const theme = useTheme()

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <BoltOutlined color="warning" fontSize="small" />
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          Registro ROP
        </Typography>
      </Box>

      <Typography variant="caption" color="text.secondary">
        Ordenes que propone el algoritmo de punto de reorden por caida de stock bajo el umbral.
      </Typography>

      <Divider sx={{ my: 1.5 }} />

      {cargando && <Typography variant="body2">Calculando...</Typography>}

      {!cargando && ordenes.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          Ningun producto esta bajo su punto de reorden con los parametros actuales.
        </Typography>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {ordenes.map((orden) => (
          <Box
            key={orden.orden_id}
            sx={{ p: 1.5, borderRadius: 2, bgcolor: alpha(theme.palette.warning.main, 0.08) }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
              <Typography variant="caption" sx={{ fontWeight: 700 }}>
                {orden.proveedor_nombre}
              </Typography>
              <Chip label={orden.estado} size="small" variant="outlined" />
            </Box>

            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              {orden.proxima_visita.displayText} · total {formatoClp(orden.total_estimado)}
            </Typography>

            {orden.items.map((item) => (
              <Disparo key={item.producto_id} item={item} />
            ))}
          </Box>
        ))}
      </Box>
    </Paper>
  )
}

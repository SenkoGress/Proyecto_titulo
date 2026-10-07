// src/features/inventario/components/PanelSugerenciaPedido.tsx
import { useState } from 'react'
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Skeleton from '@mui/material/Skeleton'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import { formatoClp } from '@/shared/utils/formatoClp'
import { useSugerenciaPedido } from '@/features/replenishment/hooks/useReplenishment'
import { useConfigRopStore } from '@/shared/stores/configRopStore'
import { DialogoSugerenciaPedido } from '@/features/inventario/components/visual/DialogoSugerenciaPedido'

// tarjeta inferior: cuantos productos necesitan reposicion, segun el algoritmo rop real
export function PanelSugerenciaPedido() {
  const { data, isPending } = useSugerenciaPedido(useConfigRopStore((estado) => estado.config))
  const [abierto, setAbierto] = useState(false)

  return (
    <Paper variant="outlined" sx={{ p: 2, display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
      <LocalShippingIcon color="primary" />
      <Box sx={{ flexGrow: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          Sugerencia de pedido {isPending ? '' : `(${data?.resumen.total_productos_criticos ?? 0})`}
        </Typography>

        {isPending ? (
          <Skeleton width={220} />
        ) : (
          <Typography variant="body2" color="text.secondary">
            {data?.resumen.total_productos_criticos
              ? `${data.resumen.total_productos_criticos} productos bajo el punto de reorden · costo estimado ${formatoClp(data.resumen.costo_total_estimado)}`
              : 'Sin productos criticos por ahora'}
          </Typography>
        )}

        {!isPending && (data?.resumen.total_productos_criticos ?? 0) > 0 && (
          <Typography
            variant="body2"
            color="primary"
            sx={{ cursor: 'pointer', fontWeight: 600, mt: 0.5 }}
            onClick={() => setAbierto(true)}
          >
            Ver detalle →
          </Typography>
        )}
      </Box>

      <DialogoSugerenciaPedido
        abierto={abierto}
        onCerrar={() => setAbierto(false)}
        productos={data?.low_stock_products ?? []}
      />
    </Paper>
  )
}

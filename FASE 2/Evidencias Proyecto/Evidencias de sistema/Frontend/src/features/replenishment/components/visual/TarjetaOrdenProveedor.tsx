// src/features/replenishment/components/visual/TarjetaOrdenProveedor.tsx
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import Tooltip from '@mui/material/Tooltip'
import EventOutlined from '@mui/icons-material/EventOutlined'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import { formatoClp } from '@/shared/utils/formatoClp'
import { alternativas } from '@/features/replenishment/utils/ordenesPorProveedor'
import type { OrdenSugerida } from '@/features/replenishment/types'

type Props = {
  orden: OrdenSugerida
  onPedir: (proveedorId: string) => void
}

// lo que hay que pedirle a un proveedor, en una tarjeta
export function TarjetaOrdenProveedor({ orden, onPedir }: Props) {
  const hoy = orden.proxima_visita.daysUntil === 0

  return (
    <Paper variant="outlined" sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 1.5, height: '100%' }}>
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {orden.proveedor_nombre}
        </Typography>

        <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center', mt: 0.25 }}>
          <EventOutlined fontSize="small" color={hoy ? 'success' : 'action'} />
          <Typography variant="body2" sx={{ fontWeight: hoy ? 700 : 400, color: hoy ? 'success.main' : 'text.secondary' }}>
            {orden.proxima_visita.displayText}
          </Typography>
        </Box>
      </Box>

      <Divider />

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, flexGrow: 1 }}>
        {orden.items.map((item) => {
          const otros = alternativas(item, orden.proveedor_id)

          return (
            <Box key={item.producto_id} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {item.producto_nombre}
                </Typography>

                <Typography variant="caption" color="text.secondary">
                  {item.is_agotado
                    ? 'Sin stock'
                    : item.stock_actual < item.stock_minimo
                      ? `Quedan ${item.stock_actual}, bajo el minimo de ${item.stock_minimo}`
                      : `Quedan ${item.stock_actual}, alcanza justo para el tiempo de entrega`}
                </Typography>

                {otros.length > 0 && (
                  <Tooltip
                    title={otros
                      .map((candidato) => `${candidato.proveedor_nombre}: ${formatoClp(candidato.precio_unitario)} c/u`)
                      .join(' · ')}
                  >
                    <Typography variant="caption" sx={{ display: 'block', color: 'primary.main', cursor: 'help' }}>
                      Otros {otros.length} proveedores lo venden
                    </Typography>
                  </Tooltip>
                )}
              </Box>

              <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 700, color: 'success.main' }}>
                  {item.cantidad_sugerida} un
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatoClp(item.costo_estimado)}
                </Typography>
              </Box>
            </Box>
          )
        })}
      </Box>

      <Divider />

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
        <Box>
          <Typography variant="caption" color="text.secondary">
            Total del pedido
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {formatoClp(orden.total_estimado)}
          </Typography>
        </Box>

        <Chip label={`${orden.items.length} productos`} size="small" variant="outlined" />
      </Box>

      <Button
        variant="contained"
        color="success"
        startIcon={<WhatsAppIcon />}
        onClick={() => onPedir(orden.proveedor_id)}
      >
        Pedir por WhatsApp
      </Button>
    </Paper>
  )
}

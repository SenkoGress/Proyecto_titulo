// src/features/replenishment/components/visual/ReabastecimientoVisual.tsx
import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import RefreshOutlined from '@mui/icons-material/RefreshOutlined'
import { ErrorBox } from '@/shared/components/ui/ErrorBox'
import { useConfigRopStore } from '@/shared/stores/configRopStore'
import { useInventario } from '@/features/inventario/hooks/useInventario'
import { useProveedores } from '@/features/proveedores/hooks/useProveedores'
import { useSugerenciaPedido } from '@/features/replenishment/hooks/useReplenishment'
import { armarFilasRop } from '@/features/replenishment/utils/detalleRop'
import { PanelEnvioOrdenes } from '@/features/replenishment/components/compartidos/PanelEnvioOrdenes'
import { TarjetasResumenRop } from '@/features/replenishment/components/compartidos/TarjetasResumenRop'
import { TarjetaOrdenProveedor } from '@/features/replenishment/components/visual/TarjetaOrdenProveedor'
import { ListaBajoStock } from '@/features/replenishment/components/visual/ListaBajoStock'
import { DialogoPedidoWhatsApp } from '@/features/proveedores/components/visual/DialogoPedidoWhatsApp'
import { armarFichasProveedores } from '@/features/proveedores/utils/fichaProveedor'
import type { FichaProveedor } from '@/features/proveedores/utils/fichaProveedor'

// que hay que pedir y a quien, para el dueno del local
export function ReabastecimientoVisual() {
  const config = useConfigRopStore((estado) => estado.config)

  const sugerencia = useSugerenciaPedido(config)
  const inventario = useInventario()
  const proveedores = useProveedores()

  const [pidiendo, setPidiendo] = useState<FichaProveedor | null>(null)

  const filas = useMemo(
    () => armarFilasRop(sugerencia.data?.low_stock_products ?? [], sugerencia.data?.suggested_orders ?? []),
    [sugerencia.data],
  )

  const fichas = useMemo(
    () => armarFichasProveedores(proveedores.data ?? [], inventario.data ?? [], [], []),
    [proveedores.data, inventario.data],
  )

  const ordenes = sugerencia.data?.suggested_orders ?? []

  const pedir = (proveedorId: string) => {
    const ficha = fichas.find((item) => item.id === proveedorId)
    if (ficha) setPidiendo(ficha)
  }

  if (sugerencia.isError) return <ErrorBox error={sugerencia.error} />

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Paper
        variant="outlined"
        sx={{ p: 2, display: 'flex', gap: 2, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Que hay que pedir
          </Typography>
          <Typography variant="body2" color="text.secondary">
            El sistema mira cuanto vendes de cada producto y calcula cuanto pedir para no quedarte sin stock.
          </Typography>
        </Box>

        <Button
          size="small"
          variant="outlined"
          startIcon={sugerencia.isFetching ? <CircularProgress size={16} /> : <RefreshOutlined />}
          onClick={() => sugerencia.refetch()}
          disabled={sugerencia.isFetching}
        >
          Recalcular
        </Button>
      </Paper>

      <TarjetasResumenRop resumen={sugerencia.data?.resumen} config={config} tecnico={false} />

      {ordenes.length > 0 && (
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
          {ordenes.map((orden) => (
            <TarjetaOrdenProveedor key={orden.orden_id} orden={orden} onPedir={pedir} />
          ))}
        </Box>
      )}

      <ListaBajoStock filas={filas} cargando={sugerencia.isPending} />

      <Box sx={{ maxWidth: 460 }}>
        <PanelEnvioOrdenes cantidadOrdenes={ordenes.length} />
      </Box>

      <Typography variant="caption" color="text.secondary">
        El pedido por WhatsApp abre el mensaje ya escrito, pero no queda registrado en el sistema: el backend no
        tiene donde guardar una orden de compra creada a mano.
      </Typography>

      {pidiendo && <DialogoPedidoWhatsApp ficha={pidiendo} onCerrar={() => setPidiendo(null)} />}
    </Box>
  )
}

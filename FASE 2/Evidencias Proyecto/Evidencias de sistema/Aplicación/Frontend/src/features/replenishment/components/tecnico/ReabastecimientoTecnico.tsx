// src/features/replenishment/components/tecnico/ReabastecimientoTecnico.tsx
import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import DownloadIcon from '@mui/icons-material/Download'
import RefreshOutlined from '@mui/icons-material/RefreshOutlined'
import { ErrorBox } from '@/shared/components/ui/ErrorBox'
import { useConfigRopStore } from '@/shared/stores/configRopStore'
import { useInventario } from '@/features/inventario/hooks/useInventario'
import { useProveedores } from '@/features/proveedores/hooks/useProveedores'
import { useSugerenciaPedido } from '@/features/replenishment/hooks/useReplenishment'
import { armarFilasRop } from '@/features/replenishment/utils/detalleRop'
import { exportarRopCsv } from '@/features/replenishment/utils/exportarRopCsv'
import { FiltroRop } from '@/features/replenishment/components/compartidos/FiltroRop'
import { PanelEnvioOrdenes } from '@/features/replenishment/components/compartidos/PanelEnvioOrdenes'
import { TarjetasResumenRop } from '@/features/replenishment/components/compartidos/TarjetasResumenRop'
import { TablaAlertasRop } from '@/features/replenishment/components/tecnico/TablaAlertasRop'
import { TablaPropuestasOrdenes } from '@/features/replenishment/components/tecnico/TablaPropuestasOrdenes'
import { DialogoPedidoWhatsApp } from '@/features/proveedores/components/visual/DialogoPedidoWhatsApp'
import { armarFichasProveedores } from '@/features/proveedores/utils/fichaProveedor'
import type { FichaProveedor } from '@/features/proveedores/utils/fichaProveedor'

// motor de reposicion completo: alertas ROP y propuestas de orden de compra
export function ReabastecimientoTecnico() {
  const config = useConfigRopStore((estado) => estado.config)
  const cambiarConfig = useConfigRopStore((estado) => estado.cambiarConfig)

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
            Motor de reposicion por punto de reorden
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Demanda diaria calculada sobre el historial de ventas x dias de entrega + stock minimo.
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <FiltroRop config={config} onCambiar={cambiarConfig} />

          <Button
            size="small"
            variant="outlined"
            startIcon={sugerencia.isFetching ? <CircularProgress size={16} /> : <RefreshOutlined />}
            onClick={() => sugerencia.refetch()}
            disabled={sugerencia.isFetching}
          >
            Recalcular
          </Button>

          <Button
            size="small"
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={() => exportarRopCsv(filas)}
            disabled={filas.length === 0}
          >
            Informe de reposicion (CSV)
          </Button>
        </Box>
      </Paper>

      <TarjetasResumenRop resumen={sugerencia.data?.resumen} config={config} tecnico />

      <TablaAlertasRop filas={filas} config={config} cargando={sugerencia.isPending} />

      <TablaPropuestasOrdenes ordenes={ordenes} cargando={sugerencia.isPending} onPedir={pedir} />

      <Box sx={{ maxWidth: 460 }}>
        <PanelEnvioOrdenes cantidadOrdenes={ordenes.length} />
      </Box>

      <Typography variant="caption" color="text.secondary">
        No hay despacho automatico: el backend no tiene webhooks, ni integracion EDI/ERP, ni WhatsApp Cloud API. El
        unico canal de salida real es el correo. Tampoco existe endpoint para guardar una orden de compra creada
        desde aca: las que se ven las propone el algoritmo cada vez que se consulta.
      </Typography>

      {pidiendo && <DialogoPedidoWhatsApp ficha={pidiendo} onCerrar={() => setPidiendo(null)} />}
    </Box>
  )
}

// src/features/pos/components/visual/CajaVisual.tsx
import Box from '@mui/material/Box'
import { CatalogoProductos } from '@/features/pos/components/visual/CatalogoProductos'
import { PanelTicket } from '@/features/pos/components/visual/PanelTicket'
import { DialogoComprobante } from '@/features/pos/components/compartidos/DialogoComprobante'
import { DialogoProductoVencido } from '@/features/pos/components/compartidos/DialogoProductoVencido'
import { useCobrarVenta } from '@/features/pos/hooks/useCobrarVenta'

// caja en modo visual: tarjetas + ticket
export function CajaVisual() {
  const { cobrar, cerrarComprobante, ventaLista, cobrando, errorCobro, empezarDeNuevo } = useCobrarVenta()

  return (
    <Box sx={{ display: 'flex', gap: 2, height: '100%' }}>
      <CatalogoProductos />

      <PanelTicket
        onCobrar={cobrar}
        cobrando={cobrando}
        errorCobro={errorCobro}
        onEmpezarDeNuevo={empezarDeNuevo}
      />

      {ventaLista && (
        <DialogoComprobante
          venta={ventaLista}
          onCerrar={cerrarComprobante}
        />
      )}
      <DialogoProductoVencido />
    </Box>
  )
}

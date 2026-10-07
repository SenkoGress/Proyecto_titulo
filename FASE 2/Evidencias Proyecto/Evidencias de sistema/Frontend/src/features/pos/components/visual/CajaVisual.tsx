// src/features/pos/components/visual/CajaVisual.tsx
import Box from '@mui/material/Box'
import { CatalogoProductos } from '@/features/pos/components/visual/CatalogoProductos'
import { PanelTicket } from '@/features/pos/components/visual/PanelTicket'
import { DialogoComprobante } from '@/features/pos/components/compartidos/DialogoComprobante'
import { useCobrarVenta } from '@/features/pos/hooks/useCobrarVenta'

// caja en modo visual: tarjetas + ticket
export function CajaVisual() {
  const { cobrar, cerrarComprobante, ventaLista, cobrando, errorCobro } = useCobrarVenta()

  return (
    <Box sx={{ display: 'flex', gap: 2, height: '100%' }}>
      <CatalogoProductos />

      <PanelTicket onCobrar={cobrar} cobrando={cobrando} errorCobro={errorCobro} />

      {ventaLista && (
        <DialogoComprobante
          venta={ventaLista.venta}
          ajusteRedondeo={ventaLista.ajusteRedondeo}
          onCerrar={cerrarComprobante}
        />
      )}
    </Box>
  )
}

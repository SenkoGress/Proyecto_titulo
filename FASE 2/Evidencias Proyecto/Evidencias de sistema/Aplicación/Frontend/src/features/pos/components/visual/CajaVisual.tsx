// src/features/pos/components/visual/CajaVisual.tsx
import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import GridViewOutlined from '@mui/icons-material/GridViewOutlined'
import ReceiptLongOutlined from '@mui/icons-material/ReceiptLongOutlined'
import { CatalogoProductos } from '@/features/pos/components/visual/CatalogoProductos'
import { TicketVisual } from '@/features/pos/components/visual/TicketVisual'
import { PanelTicket } from '@/features/pos/components/visual/PanelTicket'
import { DialogoComprobante } from '@/features/pos/components/compartidos/DialogoComprobante'
import { DialogoProductoVencido } from '@/features/pos/components/compartidos/DialogoProductoVencido'
import { useCobrarVenta } from '@/features/pos/hooks/useCobrarVenta'
import { useCarritoStore } from '@/features/pos/stores/carritoStore'

// caja en modo visual: tarjetas + ticket
export function CajaVisual() {
  const { cobrar, cerrarComprobante, ventaLista, cobrando, errorCobro, empezarDeNuevo } = useCobrarVenta()
  const hayVenta = useCarritoStore((estado) => estado.lineas.length > 0)
  const [verCatalogo, setVerCatalogo] = useState(false)

  return (
    <Box sx={{ display: 'flex', gap: 2, height: '100%' }}>
      {/* izquierda: el catalogo hasta que empieza la venta, y desde ahi lo que lleva el cliente.
          Igual que en el modo tecnico: el ticket necesita el espacio grande para leerse de lejos,
          y el boton trae el catalogo de vuelta para agregar otro producto */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, flexGrow: 1, minWidth: 0 }}>
        {hayVenta && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant={verCatalogo ? 'contained' : 'outlined'}
              startIcon={verCatalogo ? <ReceiptLongOutlined /> : <GridViewOutlined />}
              onClick={() => setVerCatalogo(!verCatalogo)}
            >
              {verCatalogo ? 'Ver la venta' : 'Ver el catalogo'}
            </Button>
          </Box>
        )}

        {hayVenta && !verCatalogo ? <TicketVisual /> : <CatalogoProductos />}
      </Box>

      {/* derecha: totales y cobro */}
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

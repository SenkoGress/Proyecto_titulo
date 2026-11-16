// src/features/invoices/components/visual/RevisionFacturaVisual.tsx
import Box from '@mui/material/Box'
import { EncabezadoFactura } from '@/features/invoices/components/visual/EncabezadoFactura'
import { TablaItemsFactura } from '@/features/invoices/components/visual/TablaItemsFactura'
import { ResumenTotales } from '@/features/invoices/components/visual/ResumenTotales'
import { BarraAccionesFactura } from '@/features/invoices/components/visual/BarraAccionesFactura'
import type { ItemFactura, PrevisualizacionFactura } from '@/features/invoices/types'

type Props = {
  preview: PrevisualizacionFactura
  items: ItemFactura[]
  totalDeclarado: number
  onCambiarFila: (indice: number, cambios: Partial<ItemFactura>) => void
  onEliminarFila: (indice: number) => void
  onAgregarFila: () => void
  onCambiarTotal: (total: number) => void
  onCancelar: () => void
  onConfirmar: () => void
  confirmando: boolean
  errorConfirmar: unknown
}

// revision de la factura para el modo visual: tarjetas y texto simple
export function RevisionFacturaVisual(props: Props) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 1200 }}>
      <EncabezadoFactura preview={props.preview} />

      <TablaItemsFactura
        items={props.items}
        onCambiarFila={props.onCambiarFila}
        onEliminarFila={props.onEliminarFila}
        onAgregarFila={props.onAgregarFila}
      />

      <ResumenTotales
        items={props.items}
        totalDeclarado={props.totalDeclarado}
        onCambiarTotal={props.onCambiarTotal}
      />

      <BarraAccionesFactura
        onCancelar={props.onCancelar}
        onConfirmar={props.onConfirmar}
        confirmando={props.confirmando}
        errorConfirmar={props.errorConfirmar}
      />
    </Box>
  )
}

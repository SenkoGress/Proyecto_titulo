// src/features/invoices/components/tecnico/RevisionFacturaTecnica.tsx
import Box from '@mui/material/Box'
import { EncabezadoTecnico } from '@/features/invoices/components/tecnico/EncabezadoTecnico'
import { PanelDatosExtraidos } from '@/features/invoices/components/tecnico/PanelDatosExtraidos'
import { TablaConciliacionTecnica } from '@/features/invoices/components/tecnico/TablaConciliacionTecnica'
import { ResumenConciliacionTecnica } from '@/features/invoices/components/tecnico/ResumenConciliacionTecnica'
import { BarraAccionesTecnica } from '@/features/invoices/components/tecnico/BarraAccionesTecnica'
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

// revision de la factura para el modo tecnico: mas datos crudos, tablas densas
export function RevisionFacturaTecnica(props: Props) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <EncabezadoTecnico preview={props.preview} />

      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
        {/* izquierda: lo que la ia extrajo, en crudo */}
        <Box sx={{ width: 320, flexShrink: 0 }}>
          <PanelDatosExtraidos preview={props.preview} />
        </Box>

        {/* derecha: conciliacion contra el catalogo + cuadratura + confirmar */}
        <Box sx={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <TablaConciliacionTecnica
            items={props.items}
            totalDeclarado={props.totalDeclarado}
            onCambiarFila={props.onCambiarFila}
            onEliminarFila={props.onEliminarFila}
            onAgregarFila={props.onAgregarFila}
          />

          <ResumenConciliacionTecnica
            items={props.items}
            totalDeclarado={props.totalDeclarado}
            onCambiarTotal={props.onCambiarTotal}
          />

          <BarraAccionesTecnica
            onCancelar={props.onCancelar}
            onConfirmar={props.onConfirmar}
            confirmando={props.confirmando}
            errorConfirmar={props.errorConfirmar}
          />
        </Box>
      </Box>
    </Box>
  )
}

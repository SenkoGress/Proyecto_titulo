// src/features/invoices/components/tecnico/PanelDatosExtraidos.tsx
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import { useConfigDte } from '@/features/dte/hooks/useConfigDte'
import type { PrevisualizacionFactura } from '@/features/invoices/types'

// una fila clave: valor, estilo terminal
function Campo({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <Box sx={{ display: 'flex', gap: 1, fontFamily: 'monospace', fontSize: 13 }}>
      <Typography component="span" variant="caption" sx={{ color: 'text.secondary', minWidth: 150 }}>
        {etiqueta}
      </Typography>
      <Typography component="span" variant="caption" sx={{ fontWeight: 600 }}>
        {valor || '—'}
      </Typography>
    </Box>
  )
}

type Props = {
  preview: PrevisualizacionFactura
}

// vuelco de los campos que la ia extrajo del documento (json crudo, en limpio)
export function PanelDatosExtraidos({ preview }: Props) {
  const { data: configLocal } = useConfigDte()

  return (
    <Paper variant="outlined" sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
        Datos DTE extraidos
      </Typography>

      <Campo etiqueta="folio_factura" valor={preview.folio_factura} />
      <Campo etiqueta="rut_proveedor" valor={preview.rut_proveedor} />
      <Campo etiqueta="razon_social" valor={preview.razon_social} />
      <Campo etiqueta="giro_proveedor" valor={preview.giro_proveedor ?? ''} />
      <Campo etiqueta="direccion_proveedor" valor={preview.direccion_proveedor ?? ''} />
      <Campo etiqueta="telefono_proveedor" valor={preview.telefono_proveedor ?? ''} />
      <Campo etiqueta="dias_visita_proveedor" valor={preview.dias_visita_proveedor ?? ''} />
      <Campo etiqueta="fecha_emision" valor={preview.fecha_emision} />
      <Campo etiqueta="proveedor_nuevo" valor={preview.es_proveedor_nuevo ? 'true' : 'false'} />

      <Divider sx={{ my: 0.5 }} />

      {/* dato nuestro, no del proveedor: quien recibe la mercaderia */}
      <Campo etiqueta="receptor" valor={configLocal?.emisor.razonSocial ?? ''} />
      <Campo etiqueta="receptor_rut" valor={configLocal?.emisor.rut ?? ''} />

      <Divider sx={{ my: 0.5 }} />

      <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
        No hay vista previa del documento: el backend no guarda el archivo original,
        solo estos campos extraidos.
      </Typography>
    </Paper>
  )
}

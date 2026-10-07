// src/features/invoices/components/EncabezadoFactura.tsx
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Skeleton from '@mui/material/Skeleton'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import StorefrontIcon from '@mui/icons-material/Storefront'
import { useConfigDte } from '@/features/dte/hooks/useConfigDte'
import { nombreMotorOcr, usoRespaldo } from '@/features/invoices/utils/proveedorOcr'
import type { PrevisualizacionFactura } from '@/features/invoices/types'

type Props = {
  preview: PrevisualizacionFactura
}

// proveedor emisor, receptor (nuestro local) y motor que la leyo
export function EncabezadoFactura({ preview }: Props) {
  const { data: configLocal, isPending: cargandoLocal } = useConfigDte()

  return (
    <Paper variant="outlined" sx={{ p: 2, display: 'flex', flexWrap: 'wrap', gap: 3 }}>
      {/* proveedor emisor */}
      <Box sx={{ display: 'flex', gap: 1.5, flexGrow: 1, minWidth: 260 }}>
        <LocalShippingIcon color="primary" />
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
            PROVEEDOR EMISOR
          </Typography>
          <Typography sx={{ fontWeight: 600 }}>{preview.razon_social}</Typography>
          <Typography variant="body2" color="text.secondary">
            RUT {preview.rut_proveedor}
          </Typography>
          {preview.es_proveedor_nuevo && (
            <Chip size="small" label="Proveedor nuevo" color="info" sx={{ mt: 0.5 }} />
          )}
        </Box>
      </Box>

      <Divider orientation="vertical" flexItem />

      {/* nosotros, el local que recibe */}
      <Box sx={{ display: 'flex', gap: 1.5, flexGrow: 1, minWidth: 220 }}>
        <StorefrontIcon color="action" />
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
            RECEPTOR
          </Typography>
          {cargandoLocal ? (
            <Skeleton width={140} />
          ) : (
            <Typography sx={{ fontWeight: 600 }}>{configLocal?.emisor.razonSocial}</Typography>
          )}
          <Typography variant="body2" color="text.secondary">
            {preview.dias_visita_proveedor ? `Visita: ${preview.dias_visita_proveedor}` : ''}
          </Typography>
        </Box>
      </Box>

      <Divider orientation="vertical" flexItem />

      {/* folio y fecha */}
      <Box sx={{ minWidth: 160 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
          FACTURA DE PROVEEDOR
        </Typography>
        <Typography sx={{ fontWeight: 600 }}>N° {preview.folio_factura}</Typography>
        <Typography variant="body2" color="text.secondary">
          {preview.fecha_emision}
        </Typography>
      </Box>

      <Box sx={{ flexBasis: '100%' }} />

      {/* motor que proceso la factura */}
      <Chip
        icon={<AutoAwesomeIcon />}
        label={nombreMotorOcr(preview.ocr_provider)}
        color={usoRespaldo(preview.ocr_provider) ? 'warning' : 'success'}
        variant="outlined"
        size="small"
      />
    </Paper>
  )
}

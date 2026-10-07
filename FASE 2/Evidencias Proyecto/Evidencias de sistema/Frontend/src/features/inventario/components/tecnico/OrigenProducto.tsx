// src/features/inventario/components/tecnico/OrigenProducto.tsx
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import AutoAwesomeOutlined from '@mui/icons-material/AutoAwesomeOutlined'
import type { ProductoInventario } from '@/features/inventario/types'

type Props = {
  producto: ProductoInventario
}

// catalogo base o producto nuevo creado por la ingesta OCR
export function OrigenProducto({ producto }: Props) {
  const nacioDeFactura = producto.origen_creacion === 'FACTURA'
  const folio = producto.factura_origen_folio

  if (nacioDeFactura) {
    return (
      <Tooltip title={`Producto nuevo: lo creo la lectura de la factura ${folio ?? 'sin folio'}`}>
        <Chip
          icon={<AutoAwesomeOutlined />}
          label={folio ? `NUEVO (${folio})` : 'NUEVO'}
          size="small"
          color="success"
          variant="outlined"
          sx={{ fontWeight: 700 }}
        />
      </Tooltip>
    )
  }

  return (
    <Tooltip
      title={
        folio
          ? `Ya estaba en el catalogo. Su ultima reposicion vino de la factura ${folio}.`
          : 'Producto del catalogo base, cargado en la puesta en marcha.'
      }
    >
      <Chip label="Catalogo base" size="small" variant="outlined" sx={{ color: 'text.secondary' }} />
    </Tooltip>
  )
}

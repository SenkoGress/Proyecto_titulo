// src/features/inventario/components/tecnico/OrigenProducto.tsx
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import AutoAwesomeOutlined from '@mui/icons-material/AutoAwesomeOutlined'
import { esProductoNuevo } from '@/features/inventario/utils/productoNuevo'
import type { ProductoInventario } from '@/features/inventario/types'

type Props = {
  producto: ProductoInventario
  ultimoZ: Date | null
}

// catalogo base, o producto que creo la ingesta OCR y todavia no pasa por un cierre
export function OrigenProducto({ producto, ultimoZ }: Props) {
  const folio = producto.factura_origen_folio

  if (esProductoNuevo(producto, ultimoZ)) {
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
          ? `Entro por la factura ${folio}. Ya paso por un cierre de caja.`
          : 'Producto del catalogo base, cargado en la puesta en marcha.'
      }
    >
      <Chip
        label={folio ? 'Del catalogo' : 'Catalogo base'}
        size="small"
        variant="outlined"
        sx={{ color: 'text.secondary' }}
      />
    </Tooltip>
  )
}

// src/features/inventario/components/compartidos/EtiquetaProductoNuevo.tsx
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import { esProductoNuevo, esProductoRepuesto } from '@/features/inventario/utils/productoNuevo'
import type { ProductoInventario } from '@/features/inventario/types'

type Props = {
  producto: ProductoInventario
  ultimoZ: Date | null
}

// lo que entro por factura y todavia no pasa por un cierre de caja
export function EtiquetaProductoNuevo({ producto, ultimoZ }: Props) {
  const esNuevo = esProductoNuevo(producto, ultimoZ)
  const esRepuesto = !esNuevo && esProductoRepuesto(producto, ultimoZ)

  if (!esNuevo && !esRepuesto) return null

  const folio = producto.factura_origen_folio

  const aviso = esNuevo
    ? folio
      ? `Producto nuevo: lo creo la lectura de la factura ${folio}`
      : 'Producto nuevo: lo creo la lectura de una factura'
    : 'Se repuso hace poco con una factura'

  return (
    <Tooltip title={aviso}>
      <Chip
        label={esNuevo ? 'Nuevo' : 'Repuesto'}
        size="small"
        color={esNuevo ? 'success' : 'info'}
        variant="outlined"
        sx={{ height: 19, fontSize: 11, fontWeight: 700, flexShrink: 0 }}
      />
    </Tooltip>
  )
}

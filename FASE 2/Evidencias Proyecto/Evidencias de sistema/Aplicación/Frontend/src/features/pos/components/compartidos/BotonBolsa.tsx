// src/features/pos/components/compartidos/BotonBolsa.tsx
import Button from '@mui/material/Button'
import Tooltip from '@mui/material/Tooltip'
import ShoppingBagOutlined from '@mui/icons-material/ShoppingBagOutlined'
import { formatoClp } from '@/shared/utils/formatoClp'
import { useProductos } from '@/features/pos/hooks/usePos'
import { useCarritoStore } from '@/features/pos/stores/carritoStore'
import { SKU_BOLSA } from '@/features/pos/utils/bolsa'

type Props = {
  compacto?: boolean
}

// ley 21.100: no se entregan bolsas plasticas, se vende la reutilizable
export function BotonBolsa({ compacto }: Props) {
  const { data: productos } = useProductos()
  const agregar = useCarritoStore((estado) => estado.agregar)

  const bolsa = productos?.find((producto) => producto.sku === SKU_BOLSA)

  if (!bolsa) {
    return (
      <Tooltip title={`No hay un producto con SKU ${SKU_BOLSA} en el catalogo`}>
        <span>
          <Button size="small" variant="outlined" startIcon={<ShoppingBagOutlined />} disabled fullWidth={!compacto}>
            Bolsa
          </Button>
        </span>
      </Tooltip>
    )
  }

  return (
    <Tooltip title="Ley 21.100: cobrar la bolsa reutilizable">
      <Button
        size="small"
        variant="outlined"
        startIcon={<ShoppingBagOutlined />}
        onClick={() => agregar(bolsa)}
        disabled={bolsa.stock_actual <= 0}
        fullWidth={!compacto}
      >
        {compacto ? 'Bolsa' : `Agregar bolsa ${formatoClp(bolsa.precio_venta)}`}
      </Button>
    </Tooltip>
  )
}

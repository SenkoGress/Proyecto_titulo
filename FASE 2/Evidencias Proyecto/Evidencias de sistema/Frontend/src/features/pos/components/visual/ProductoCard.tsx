// src/features/pos/components/visual/ProductoCard.tsx
import Card from '@mui/material/Card'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { EtiquetasProducto } from '@/features/pos/components/compartidos/EtiquetasProducto'
import IconButton from '@mui/material/IconButton'
import AddIcon from '@mui/icons-material/Add'
import { formatoClp } from '@/shared/utils/formatoClp'
import { colorCategoria } from '@/features/pos/utils/categorias'
import type { Producto } from '@/features/pos/types'

type Props = {
  producto: Producto
  onAgregar: (producto: Producto) => void
}

// tarjeta de producto
export function ProductoCard({ producto, onAgregar }: Props) {
  const categoria = producto.categoria ?? 'Sin categoria'
  const color = colorCategoria(categoria)

  const sinStock = producto.stock_actual <= 0
  const stockBajo = !sinStock && producto.stock_actual <= producto.stock_minimo

  return (
    <Card
      sx={{
        display: 'flex',
        flexDirection: 'column',
        borderTop: `4px solid ${color}`,
        opacity: sinStock ? 0.5 : 1,
        height: '100%',
      }}
    >
      {/* categoria y stock */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 1.5, pt: 1.5 }}>
        <Typography variant="caption" sx={{ color, fontWeight: 700, letterSpacing: 0.4 }}>
          {categoria.toUpperCase()}
        </Typography>
        <Typography
          variant="caption"
          sx={{ color: stockBajo ? 'warning.main' : 'text.secondary', fontWeight: 600 }}
        >
          {producto.stock_actual} un.
        </Typography>
      </Box>

      <Box sx={{ px: 1.5, pt: 0.5, flexGrow: 1 }}>
        <Typography sx={{ fontWeight: 600, lineHeight: 1.25 }}>{producto.nombre}</Typography>

        {/* tiquetado: alcohol, energetica, azucar */}
        <Box sx={{ mt: 0.5 }}>
          <EtiquetasProducto producto={producto} />
        </Box>
      </Box>

      {/* precio y boton agregar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 1.5,
          py: 1.5,
        }}
      >
        <Typography sx={{ fontWeight: 700, color: 'primary.main' }}>
          {formatoClp(producto.precio_venta)}
        </Typography>

        <IconButton
          size="small"
          disabled={sinStock}
          aria-label={`Agregar ${producto.nombre}`}
          onClick={() => onAgregar(producto)}
          sx={{ bgcolor: 'primary.main', color: 'common.white', '&:hover': { bgcolor: 'primary.dark' } }}
        >
          <AddIcon fontSize="small" />
        </IconButton>
      </Box>
    </Card>
  )
}

// src/features/pos/components/visual/TicketVisual.tsx
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined'
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined'
import { formatoClp } from '@/shared/utils/formatoClp'
import { useCarritoStore, type LineaCarrito } from '@/features/pos/stores/carritoStore'
import { useImagenesProductos } from '@/features/pos/hooks/useImagenesProductos'
import { EtiquetasProducto } from '@/features/pos/components/compartidos/EtiquetasProducto'

// lo que lleva el cliente, en grande: la foto del producto y el subtotal se leen de lejos, que es
// lo que la caja necesita cuando hay alguien esperando al otro lado del mesón
function Linea({ linea, imagen }: { linea: LineaCarrito; imagen?: string }) {
  const agregar = useCarritoStore((estado) => estado.agregar)
  const quitarUno = useCarritoStore((estado) => estado.quitarUno)
  const eliminarLinea = useCarritoStore((estado) => estado.eliminarLinea)

  const subtotal = linea.producto.precio_venta * linea.cantidad
  const alcanzoElStock = linea.cantidad >= linea.producto.stock_actual

  return (
    <Paper
      variant="outlined"
      sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 1.5, mb: 1.25, borderRadius: 2 }}
    >
      {/* foto */}
      <Box
        sx={{
          width: 72,
          height: 72,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'action.hover',
          borderRadius: 1.5,
          overflow: 'hidden',
        }}
      >
        {imagen ? (
          <Box
            component="img"
            src={imagen}
            alt=""
            loading="lazy"
            sx={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        ) : (
          <ImageOutlinedIcon sx={{ color: 'text.disabled', fontSize: 30 }} />
        )}
      </Box>

      {/* nombre y precio unitario */}
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '1.05rem', lineHeight: 1.3 }}>
          {linea.producto.nombre}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
          {formatoClp(linea.producto.precio_venta)} c/u
        </Typography>
        <EtiquetasProducto producto={linea.producto} soloPrincipal />
      </Box>

      {/* cantidad */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
        <IconButton onClick={() => quitarUno(linea.producto.id)} aria-label={`Quitar uno de ${linea.producto.nombre}`}>
          <RemoveIcon />
        </IconButton>

        <Typography sx={{ minWidth: 36, textAlign: 'center', fontWeight: 700, fontSize: '1.3rem' }}>
          {linea.cantidad}
        </Typography>

        <IconButton
          disabled={alcanzoElStock}
          onClick={() => agregar(linea.producto)}
          aria-label={`Agregar otro ${linea.producto.nombre}`}
        >
          <AddIcon />
        </IconButton>
      </Box>

      {/* subtotal */}
      <Typography sx={{ fontWeight: 700, fontSize: '1.25rem', minWidth: 104, textAlign: 'right', flexShrink: 0 }}>
        {formatoClp(subtotal)}
      </Typography>

      <IconButton
        color="error"
        onClick={() => eliminarLinea(linea.producto.id)}
        aria-label={`Quitar ${linea.producto.nombre} de la venta`}
      >
        <DeleteOutlineIcon />
      </IconButton>
    </Paper>
  )
}

// el ticket en el espacio grande, como la tabla del modo tecnico pero con fotos
export function TicketVisual() {
  const lineas = useCarritoStore((estado) => estado.lineas)
  const fotos = useImagenesProductos()

  const unidades = lineas.reduce((suma, linea) => suma + linea.cantidad, 0)

  if (lineas.length === 0) {
    return (
      <Paper
        variant="outlined"
        sx={{
          flexGrow: 1,
          borderRadius: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1,
          color: 'text.secondary',
        }}
      >
        <ShoppingCartOutlinedIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
        <Typography>Agrega productos desde el catalogo o escanea un codigo de barras.</Typography>
      </Paper>
    )
  }

  return (
    <Paper
      variant="outlined"
      sx={{ flexGrow: 1, borderRadius: 2, display: 'flex', flexDirection: 'column', minHeight: 0 }}
    >
      <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 1.5 }}>
        {lineas.map((linea) => (
          <Linea key={linea.producto.id} linea={linea} imagen={fotos.get(linea.producto.id)} />
        ))}
      </Box>

      <Box
        sx={{
          borderTop: 1,
          borderColor: 'divider',
          px: 2,
          py: 1,
          display: 'flex',
          gap: 2,
          color: 'text.secondary',
        }}
      >
        <Typography variant="body2">
          {lineas.length} producto(s) · {unidades} unidad(es)
        </Typography>
      </Box>
    </Paper>
  )
}

// src/features/pos/components/visual/CatalogoProductos.tsx
import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Skeleton from '@mui/material/Skeleton'
import Typography from '@mui/material/Typography'
import { ErrorBox } from '@/shared/components/ui/ErrorBox'
import { ProductoCard } from '@/features/pos/components/visual/ProductoCard'
import { useImagenesProductos } from '@/features/pos/hooks/useImagenesProductos'
import { useProductos } from '@/features/pos/hooks/usePos'
import { useCarritoStore } from '@/features/pos/stores/carritoStore'
import {
  coincideBusqueda,
  contarCategorias,
  nombreCategoria,
} from '@/features/pos/utils/categorias'

const TODOS = 'Todos'

type Props = {
  busqueda: string
}

// categorias y grilla. El buscador vive aparte, en BuscadorVisual, porque el lector necesita un
// campo montado tambien cuando esta grilla cede el espacio a la venta
export function CatalogoProductos({ busqueda }: Props) {
  const { data: productos, isPending, isError, error } = useProductos()
  const fotos = useImagenesProductos()
  const agregar = useCarritoStore((estado) => estado.agregar)

  const [categoria, setCategoria] = useState(TODOS)

  // categorias con cantidad
  const categorias = useMemo(() => {
    if (!productos) return []
    return [{ nombre: TODOS, cantidad: productos.length }, ...contarCategorias(productos)]
  }, [productos])

  // filtrar productos
  const productosFiltrados = useMemo(() => {
    if (!productos) return []
    return productos.filter(
      (producto) =>
        (categoria === TODOS || nombreCategoria(producto) === categoria) &&
        coincideBusqueda(producto, busqueda),
    )
  }, [productos, busqueda, categoria])

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, height: '100%', minWidth: 0, flexGrow: 1 }}>
      {/* filtro por categoria */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {categorias.map((item) => (
          <Chip
            key={item.nombre}
            label={`${item.nombre}  ${item.cantidad}`}
            onClick={() => setCategoria(item.nombre)}
            color={categoria === item.nombre ? 'primary' : 'default'}
            variant={categoria === item.nombre ? 'filled' : 'outlined'}
          />
        ))}
      </Box>

      {/* grilla */}
      <Box sx={{ flexGrow: 1, overflowY: 'auto', pr: 0.5 }}>
        {isError && <ErrorBox error={error} />}

        {isPending && (
          <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: 'repeat(4, 1fr)' }}>
            {Array.from({ length: 8 }).map((_, indice) => (
              <Skeleton key={indice} variant="rounded" height={150} />
            ))}
          </Box>
        )}

        {productos && productosFiltrados.length === 0 && (
          <Typography color="text.secondary" sx={{ p: 2 }}>
            No hay productos que coincidan con la busqueda.
          </Typography>
        )}

        <Box
          sx={{
            display: 'grid',
            gap: 1.5,
            gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(4, 1fr)' },
          }}
        >
          {productosFiltrados.map((producto) => (
            <ProductoCard
              key={producto.id}
              producto={producto}
              onAgregar={agregar}
              imagen={fotos.get(producto.id)}
              conFoto={fotos.size > 0}
            />
          ))}
        </Box>
      </Box>
    </Box>
  )
}

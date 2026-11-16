// src/features/inventario/components/BarraHerramientasInventario.tsx
import { Link } from 'react-router'
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import SearchIcon from '@mui/icons-material/Search'
import DownloadIcon from '@mui/icons-material/Download'
import RequestQuoteIcon from '@mui/icons-material/RequestQuote'
import AddIcon from '@mui/icons-material/Add'
import DeleteSweepOutlined from '@mui/icons-material/DeleteSweepOutlined'
import { BotonSincronizar } from '@/shared/components/layout/BotonSincronizar'
import type { ProductoInventario } from '@/features/inventario/types'
import { contarCategorias } from '@/features/inventario/utils/categoriasInventario'

type Props = {
  productos: ProductoInventario[]
  busqueda: string
  categoria: string
  onBuscar: (texto: string) => void
  onElegirCategoria: (categoria: string) => void
  onExportar: () => void
  onAgregar: () => void
  onVerMermas: () => void
}

// buscador + filtros por categoria + acciones (agregar, exportar, recibir mercaderia)
export function BarraHerramientasInventario({
  productos,
  busqueda,
  categoria,
  onBuscar,
  onElegirCategoria,
  onExportar,
  onAgregar,
  onVerMermas,
}: Props) {
  const categorias = contarCategorias(productos)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          value={busqueda}
          onChange={(evento) => onBuscar(evento.target.value)}
          placeholder="Buscar por producto, SKU o codigo de barra"
          size="small"
          sx={{ flexGrow: 1, minWidth: 240, bgcolor: 'background.paper' }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />

        <Button size="small" startIcon={<DownloadIcon />} onClick={onExportar} disabled={productos.length === 0}>
          Exportar CSV
        </Button>

        <Button size="small" variant="contained" startIcon={<RequestQuoteIcon />} component={Link} to="/facturas">
          Recepcion mercaderia
        </Button>

        <Button size="small" startIcon={<DeleteSweepOutlined />} onClick={onVerMermas}>
          Mermas
        </Button>

        <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={onAgregar}>
          Añadir producto
        </Button>

        <BotonSincronizar />
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {categorias.map((item) => (
          <Chip
            key={item.nombre}
            label={`${item.nombre} (${item.cantidad})`}
            onClick={() => onElegirCategoria(item.nombre)}
            color={categoria === item.nombre ? 'primary' : 'default'}
            variant={categoria === item.nombre ? 'filled' : 'outlined'}
            size="small"
          />
        ))}
      </Box>
    </Box>
  )
}

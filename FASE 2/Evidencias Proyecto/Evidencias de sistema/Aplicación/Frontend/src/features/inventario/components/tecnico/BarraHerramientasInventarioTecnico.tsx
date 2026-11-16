// src/features/inventario/components/tecnico/BarraHerramientasInventarioTecnico.tsx
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import SearchIcon from '@mui/icons-material/Search'
import DownloadIcon from '@mui/icons-material/Download'
import AddIcon from '@mui/icons-material/Add'
import DeleteSweepOutlined from '@mui/icons-material/DeleteSweepOutlined'
import LocalOfferOutlined from '@mui/icons-material/LocalOfferOutlined'
import Tooltip from '@mui/material/Tooltip'
import { contarCategorias, TODAS_CATEGORIAS } from '@/features/inventario/utils/categoriasInventario'
import { contarCriticos, SOLO_CRITICOS } from '@/features/inventario/utils/filtrosVencimientos'
import type { FilaFefo } from '@/features/inventario/utils/matrizFefo'

type Props = {
  productos: FilaFefo[]
  busqueda: string
  categoria: string
  onBuscar: (texto: string) => void
  onElegirCategoria: (categoria: string) => void
  onExportar: () => void
  cantidadSeleccionada: number
  onImprimirEtiquetas: () => void
  onAgregar: () => void
  onVerMermas: () => void
}

// buscador + categorias (igual que el catalogo visual) + filtro rapido de criticos fefo
export function BarraHerramientasInventarioTecnico({
  productos,
  busqueda,
  categoria,
  onBuscar,
  onElegirCategoria,
  onExportar,
  cantidadSeleccionada,
  onImprimirEtiquetas,
  onAgregar,
  onVerMermas,
}: Props) {
  const categorias = contarCategorias(productos)
  const criticos = contarCriticos(productos)

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

        <Button size="small" startIcon={<DeleteSweepOutlined />} onClick={onVerMermas}>
          Historial de mermas
        </Button>

        <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={onAgregar}>
          Alta de producto
        </Button>

        <Tooltip title={cantidadSeleccionada > 0 ? '' : 'Marca productos en la tabla para imprimir sus etiquetas'}>
          <span>
            <Button
              size="small"
              variant="outlined"
              startIcon={<LocalOfferOutlined />}
              onClick={onImprimirEtiquetas}
              disabled={cantidadSeleccionada === 0}
            >
              Etiquetas de gondola ({cantidadSeleccionada})
            </Button>
          </span>
        </Tooltip>
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {/* atajo directo a los criticos fefo, ademas de las categorias normales */}
        <Chip
          label={`⚠ Criticos FEFO (${criticos})`}
          onClick={() => onElegirCategoria(SOLO_CRITICOS)}
          color={categoria === SOLO_CRITICOS ? 'error' : 'default'}
          variant={categoria === SOLO_CRITICOS ? 'filled' : 'outlined'}
          size="small"
        />

        {categorias.map((item) => (
          <Chip
            key={item.nombre}
            label={item.nombre === TODAS_CATEGORIAS ? `Todos (${item.cantidad})` : `${item.nombre} (${item.cantidad})`}
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

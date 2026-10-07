// src/features/proveedores/components/visual/BarraHerramientasProveedores.tsx
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import SearchOutlined from '@mui/icons-material/SearchOutlined'
import AddOutlined from '@mui/icons-material/AddOutlined'
import { contarRubros } from '@/features/proveedores/utils/filtrarProveedores'
import type { FichaProveedor } from '@/features/proveedores/utils/fichaProveedor'

type Props = {
  fichas: FichaProveedor[]
  busqueda: string
  rubro: string
  onBuscar: (texto: string) => void
  onElegirRubro: (rubro: string) => void
  onNuevo: () => void
}

// buscador + filtro por rubro + alta de proveedor
export function BarraHerramientasProveedores({
  fichas,
  busqueda,
  rubro,
  onBuscar,
  onElegirRubro,
  onNuevo,
}: Props) {
  const rubros = contarRubros(fichas)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          value={busqueda}
          onChange={(evento) => onBuscar(evento.target.value)}
          placeholder="Buscar por proveedor, RUT, giro o telefono"
          size="small"
          sx={{ flexGrow: 1, minWidth: 260, bgcolor: 'background.paper' }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchOutlined fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />

        <Button variant="contained" startIcon={<AddOutlined />} onClick={onNuevo}>
          Nuevo Proveedor
        </Button>
      </Box>

      {/* rubros reales, sacados de las categorias de los productos que surte cada uno */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {rubros.map((item) => (
          <Chip
            key={item.nombre}
            label={`${item.nombre} (${item.cantidad})`}
            onClick={() => onElegirRubro(item.nombre)}
            color={rubro === item.nombre ? 'primary' : 'default'}
            variant={rubro === item.nombre ? 'filled' : 'outlined'}
            size="small"
          />
        ))}

        {rubros.length === 1 && (
          <Chip label="Sin rubros: ningun producto tiene proveedor asignado" size="small" variant="outlined" disabled />
        )}
      </Box>
    </Box>
  )
}

// src/features/proveedores/components/tecnico/BarraHerramientasProveedoresTecnica.tsx
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import SearchOutlined from '@mui/icons-material/SearchOutlined'
import DownloadIcon from '@mui/icons-material/Download'
import AddOutlined from '@mui/icons-material/AddOutlined'
import { FiltroRop } from '@/features/replenishment/components/compartidos/FiltroRop'
import { contarRubros } from '@/features/proveedores/utils/filtrarProveedores'
import type { ConfigRop } from '@/features/replenishment/types'
import type { FichaProveedor } from '@/features/proveedores/utils/fichaProveedor'

type Props = {
  fichas: FichaProveedor[]
  busqueda: string
  rubro: string
  configRop: ConfigRop
  onBuscar: (texto: string) => void
  onElegirRubro: (rubro: string) => void
  onCambiarRop: (config: ConfigRop) => void
  onExportar: () => void
  onNuevo: () => void
}

// buscador + filtro rop + exportar + alta (con atajo F4)
export function BarraHerramientasProveedoresTecnica({
  fichas,
  busqueda,
  rubro,
  configRop,
  onBuscar,
  onElegirRubro,
  onCambiarRop,
  onExportar,
  onNuevo,
}: Props) {
  const rubros = contarRubros(fichas)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          value={busqueda}
          onChange={(evento) => onBuscar(evento.target.value)}
          placeholder="Buscar por RUT, razon social, giro o telefono"
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

        <FiltroRop config={configRop} onCambiar={onCambiarRop} />

        <Button size="small" startIcon={<DownloadIcon />} onClick={onExportar} disabled={fichas.length === 0}>
          Exportar CSV
        </Button>

        <Button size="small" variant="contained" startIcon={<AddOutlined />} onClick={onNuevo}>
          Nuevo Proveedor [F4]
        </Button>
      </Box>

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
      </Box>
    </Box>
  )
}

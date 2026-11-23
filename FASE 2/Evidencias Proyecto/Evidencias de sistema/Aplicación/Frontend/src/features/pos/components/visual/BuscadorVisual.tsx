// src/features/pos/components/visual/BuscadorVisual.tsx
import { useRef } from 'react'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import SearchIcon from '@mui/icons-material/Search'
import { useProductos } from '@/features/pos/hooks/usePos'
import { useCarritoStore } from '@/features/pos/stores/carritoStore'
import { coincideBusqueda } from '@/features/pos/utils/categorias'

type Props = {
  busqueda: string
  onBuscar: (texto: string) => void
}

// El lector de codigos escribe aca y termina con Enter, asi que este campo tiene que seguir
// montado tambien mientras se ve la venta: si se desmonta, el segundo producto escaneado no llega
// a ninguna parte y nadie se entera. Busca sobre todo el catalogo, sin el filtro de categoria: un
// codigo escaneado tiene que encontrar su producto aunque la categoria abierta sea otra.
export function BuscadorVisual({ busqueda, onBuscar }: Props) {
  const { data: productos } = useProductos()
  const agregar = useCarritoStore((estado) => estado.agregar)
  const campo = useRef<HTMLInputElement>(null)

  function alPresionarEnter(evento: React.KeyboardEvent) {
    if (evento.key !== 'Enter') return

    const coincidencias = (productos ?? []).filter((producto) => coincideBusqueda(producto, busqueda))
    const unico = busqueda.trim() !== '' && coincidencias.length === 1 ? coincidencias[0] : undefined
    if (!unico) return

    agregar(unico)
    onBuscar('')
    // el lector sigue escribiendo en el mismo campo: el foco no se mueve
    campo.current?.focus()
  }

  return (
    <TextField
      inputRef={campo}
      value={busqueda}
      onChange={(evento) => onBuscar(evento.target.value)}
      onKeyDown={alPresionarEnter}
      placeholder="Buscar por nombre, codigo o escanear producto"
      size="small"
      fullWidth
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
        },
      }}
      sx={{ bgcolor: 'background.paper' }}
    />
  )
}

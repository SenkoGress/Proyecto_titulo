// src/features/pos/components/tecnico/BuscadorTecnico.tsx
import { useMemo, useRef, useState } from 'react'
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Autocomplete from '@mui/material/Autocomplete'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner'
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart'
import { ErrorBox } from '@/shared/components/ui/ErrorBox'
import { formatoClp } from '@/shared/utils/formatoClp'
import { useProductos } from '@/features/pos/hooks/usePos'
import { useCarritoStore } from '@/features/pos/stores/carritoStore'
import {
  coincideBusqueda,
  contarCategorias,
  nombreCategoria,
} from '@/features/pos/utils/categorias'
import { ID_BUSCADOR } from '@/features/pos/components/tecnico/ids'
import type { Producto } from '@/features/pos/types'

const TODOS = 'Todos'
const MAX_RESULTADOS = 10

// buscador por codigo o nombre + filtro
export function BuscadorTecnico() {
  const { data: productos = [], isError, error } = useProductos()
  const agregar = useCarritoStore((estado) => estado.agregar)

  const [texto, setTexto] = useState('')
  const [categoria, setCategoria] = useState(TODOS)
  const resaltado = useRef<Producto | null>(null) // opcion marcada con flechas
  const [abierto, setAbierto] = useState(false)

  // categorias con cantidad
  const categorias = useMemo(
    () => [{ nombre: TODOS, cantidad: productos.length }, ...contarCategorias(productos)],
    [productos],
  )

  // resultados: codigo exacto primero
  const resultados = useMemo(() => {
    const buscado = texto.trim().toLowerCase()

    const filtrados = productos.filter(
      (producto) =>
        (categoria === TODOS || nombreCategoria(producto) === categoria) &&
        coincideBusqueda(producto, texto),
    )

    const exactos = filtrados.filter(
      (producto) => producto.codigo_barra === buscado || producto.sku.toLowerCase() === buscado,
    )
    const resto = filtrados.filter((producto) => !exactos.includes(producto))

    return [...exactos, ...resto].slice(0, MAX_RESULTADOS)
  }, [productos, texto, categoria])

  // agregar y limpiar
  function agregarProducto(producto: Producto | null | undefined) {
    if (!producto) return
    agregar(producto)
    setTexto('')
    resaltado.current = null
  }

  // enter: el resaltado con flechas o el primero
  function alPresionarTecla(evento: React.KeyboardEvent & { defaultMuiPrevented?: boolean }) {
    if (evento.key !== 'Enter') return
    evento.defaultMuiPrevented = true
    evento.preventDefault()
    agregarProducto(resaltado.current ?? resultados[0])
  }

  return (
    <Paper elevation={0} sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 2 }}>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Autocomplete
          id={ID_BUSCADOR}
          sx={{ flexGrow: 1 }}
          options={resultados}
          filterOptions={(opciones) => opciones}
          // lista solo cuando hay texto
          open={abierto && texto.trim() !== ''}
          onOpen={() => setAbierto(true)}
          onClose={() => setAbierto(false)}
          getOptionLabel={(producto) => producto.nombre}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          inputValue={texto}
          onInputChange={(_evento, valor, razon) => {
            if (razon !== 'reset') setTexto(valor)
          }}
          value={null}
          onChange={(_evento, producto) => agregarProducto(producto)}
          onHighlightChange={(_evento, producto) => {
            resaltado.current = producto
          }}
          onKeyDown={alPresionarTecla}
          noOptionsText="Sin resultados"
          renderOption={(props, producto) => {
            const { key, ...resto } = props
            return (
              <Box component="li" key={key} {...resto} sx={{ display: 'flex', gap: 2 }}>
                <Typography variant="caption" sx={{ fontFamily: 'monospace', width: 110 }}>
                  {producto.codigo_barra ?? producto.sku}
                </Typography>
                <Typography variant="body2" sx={{ flexGrow: 1 }}>
                  {producto.nombre}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {producto.stock_actual} un
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, width: 80, textAlign: 'right' }}>
                  {formatoClp(producto.precio_venta)}
                </Typography>
              </Box>
            )
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              size="small"
              placeholder="Escanear codigo de barras o buscar producto (F2)"
              slotProps={{
                ...params.slotProps,
                input: {
                  ...params.slotProps.input,
                  startAdornment: (
                    <InputAdornment position="start">
                      <QrCodeScannerIcon fontSize="small" color="primary" />
                    </InputAdornment>
                  ),
                  sx: { fontFamily: 'monospace' },
                },
              }}
            />
          )}
        />

        {/* agregar el primer resultado */}
        <Button
          variant="contained"
          startIcon={<AddShoppingCartIcon />}
          disabled={resultados.length === 0 || texto.trim() === ''}
          onClick={() => agregarProducto(resultados[0])}
        >
          Agregar [Enter]
        </Button>
      </Box>

      {/* filtro por categoria */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.5, flexWrap: 'wrap' }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
          FILTRO:
        </Typography>
        {categorias.map((item) => (
          <Chip
            key={item.nombre}
            size="small"
            label={`${item.nombre} (${item.cantidad})`}
            onClick={() => setCategoria(item.nombre)}
            color={categoria === item.nombre ? 'primary' : 'default'}
            variant={categoria === item.nombre ? 'filled' : 'outlined'}
          />
        ))}
      </Box>

      {isError && (
        <Box sx={{ mt: 1 }}>
          <ErrorBox error={error} />
        </Box>
      )}
    </Paper>
  )
}

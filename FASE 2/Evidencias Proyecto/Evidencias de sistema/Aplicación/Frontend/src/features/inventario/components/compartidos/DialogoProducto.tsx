// src/features/inventario/components/compartidos/DialogoProducto.tsx
import { useMemo, useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Autocomplete from '@mui/material/Autocomplete'
import MenuItem from '@mui/material/MenuItem'
import Box from '@mui/material/Box'
import Alert from '@mui/material/Alert'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import Tooltip from '@mui/material/Tooltip'
import CircularProgress from '@mui/material/CircularProgress'
import SearchOutlined from '@mui/icons-material/SearchOutlined'
import { OPCIONES_ILA, TASA_ILA } from '@/shared/utils/ila'
import { buscarPorCodigoBarras } from '@/features/inventario/api/inventario.api'
import { codigoBuscable } from '@/features/inventario/utils/fichaCodigoBarras'
import { SugerenciaCodigoBarras } from '@/features/inventario/components/compartidos/SugerenciaCodigoBarras'
import { CampoFoto } from '@/features/inventario/components/compartidos/CampoFoto'
import { categoriasExistentes } from '@/features/inventario/utils/categoriasExistentes'
import { useInventario } from '@/features/inventario/hooks/useInventario'
import { useCrearProducto, useEditarProducto } from '@/features/inventario/hooks/useInventario'
import { useProveedores } from '@/features/proveedores/hooks/useProveedores'
import { obtenerMensajeError } from '@/lib/api/apiError'
import type { ProductoInventario } from '@/features/inventario/types'
import type { ResultadoBusqueda } from '@/features/inventario/utils/fichaCodigoBarras'

type Props = {
  abierto: boolean
  onCerrar: () => void
  producto?: ProductoInventario | null
}

type Formulario = {
  nombre: string
  sku: string
  codigo_barra: string
  categoria: string
  proveedor_id: string
  precio_compra: string
  precio_venta: string
  stock_actual: string
  stock_minimo: string
  lote: string
  fecha_vencimiento: string
  impuesto_adicional_codigo: number
  imagen: string | null
}

const VACIO: Formulario = {
  nombre: '',
  sku: '',
  codigo_barra: '',
  categoria: '',
  proveedor_id: '',
  precio_compra: '',
  precio_venta: '',
  stock_actual: '',
  stock_minimo: '',
  lote: '',
  fecha_vencimiento: '',
  impuesto_adicional_codigo: 0,
  imagen: null,
}

function desdeProducto(producto: ProductoInventario): Formulario {
  return {
    nombre: producto.nombre,
    sku: producto.sku,
    codigo_barra: producto.codigo_barra ?? '',
    categoria: producto.categoria ?? '',
    proveedor_id: '',
    precio_compra: String(producto.precio_compra ?? ''),
    precio_venta: String(producto.precio_venta ?? ''),
    stock_actual: String(producto.stock_actual ?? ''),
    stock_minimo: String(producto.stock_minimo ?? ''),
    lote: producto.lote ?? '',
    fecha_vencimiento: producto.fecha_vencimiento ?? '',
    impuesto_adicional_codigo: Number(producto.impuesto_adicional_codigo) || 0,
    imagen: producto.imagen ?? null,
  }
}

function aNumero(texto: string): number {
  return Number(texto) || 0
}

export function DialogoProducto({ abierto, onCerrar, producto }: Props) {
  const editando = Boolean(producto)
  const [form, setForm] = useState<Formulario>(producto ? desdeProducto(producto) : VACIO)
  const crear = useCrearProducto()
  const editar = useEditarProducto()
  const { data: proveedores } = useProveedores()

  const guardando = crear.isPending || editar.isPending
  const error = crear.error ?? editar.error
  const faltanDatos = !form.nombre.trim() || !form.sku.trim()

  // la ficha de Open Food Facts se ofrece al lado y no entra sola: el nombre lo cambia la
  // persona al aceptarla
  const { data: inventario } = useInventario()
  const categorias = useMemo(() => categoriasExistentes(inventario ?? []), [inventario])
  const [sugerencia, setSugerencia] = useState<ResultadoBusqueda | null>(null)
  const [buscando, setBuscando] = useState(false)

  const puedeBuscar = !editando && codigoBuscable(form.codigo_barra) && !buscando

  async function buscarCodigo() {
    if (!puedeBuscar) return
    setBuscando(true)
    setSugerencia(await buscarPorCodigoBarras(form.codigo_barra))
    setBuscando(false)
  }

  function cambiar(campo: keyof Formulario, valor: string | number) {
    setForm((previo) => ({ ...previo, [campo]: valor }))
    // la sugerencia era de otro codigo: dejarla a la vista confundiria
    if (campo === 'codigo_barra') setSugerencia(null)
  }

  async function guardar() {
    const comunes = {
      nombre: form.nombre.trim(),
      codigo_barra: form.codigo_barra.trim() || undefined,
      categoria: form.categoria.trim() || 'General',
      proveedor_id: form.proveedor_id || null,
      precio_compra: aNumero(form.precio_compra),
      precio_venta: aNumero(form.precio_venta),
      stock_minimo: aNumero(form.stock_minimo),
      lote: form.lote.trim() || null,
      fecha_vencimiento: form.fecha_vencimiento || null,
      impuesto_adicional_codigo: form.impuesto_adicional_codigo,
      impuesto_adicional_tasa: TASA_ILA[form.impuesto_adicional_codigo] ?? 0,
      imagen: form.imagen,
    }

    if (producto) {
      await editar.mutateAsync({ id: producto.id, cambios: comunes })
    } else {
      await crear.mutateAsync({
        ...comunes,
        sku: form.sku.trim(),
        stock_actual: aNumero(form.stock_actual),
      })
    }

    onCerrar()
  }

  return (
    <Dialog open={abierto} onClose={onCerrar} maxWidth="sm" fullWidth>
      <DialogTitle>{editando ? 'Editar producto' : 'Agregar producto'}</DialogTitle>

      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {obtenerMensajeError(error)}
          </Alert>
        )}

        {sugerencia && (
          <SugerenciaCodigoBarras
            resultado={sugerencia}
            onUsar={(nombre) => {
              cambiar('nombre', nombre)
              // la ficha trae la foto ya incrustada, y solo se usa si no hay una propia
              const foto = sugerencia.encontrada?.imagen
              if (foto && !form.imagen) setForm((previo) => ({ ...previo, imagen: foto }))
              setSugerencia(null)
            }}
            onIgnorar={() => setSugerencia(null)}
          />
        )}

        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <TextField
            label="Nombre"
            value={form.nombre}
            onChange={(evento) => cambiar('nombre', evento.target.value)}
            required
            autoFocus
            sx={{ gridColumn: '1 / -1' }}
          />

          <TextField
            label="Codigo interno (SKU)"
            value={form.sku}
            onChange={(evento) => cambiar('sku', evento.target.value)}
            required
            disabled={editando}
            helperText={editando ? 'El codigo no se puede cambiar' : 'Como lo identificas tu'}
          />

          {/* la pistola lectora escribe el codigo y manda Enter, por eso busca con Enter ademas
              del boton */}
          <TextField
            label="Codigo de barras"
            value={form.codigo_barra}
            onChange={(evento) => cambiar('codigo_barra', evento.target.value)}
            onKeyDown={(evento) => {
              if (evento.key !== 'Enter') return
              evento.preventDefault()
              void buscarCodigo()
            }}
            helperText={
              editando
                ? 'Si lo dejas vacio se genera uno'
                : 'Escanealo o escribelo y busca sus datos'
            }
            slotProps={{
              input: {
                endAdornment: !editando && (
                  <InputAdornment position="end">
                    <Tooltip
                      title={
                        codigoBuscable(form.codigo_barra)
                          ? 'Buscar los datos de este producto'
                          : 'Escribe un codigo de 8 a 14 digitos'
                      }
                    >
                      <span>
                        <IconButton size="small" onClick={buscarCodigo} disabled={!puedeBuscar}>
                          {buscando ? <CircularProgress size={18} /> : <SearchOutlined fontSize="small" />}
                        </IconButton>
                      </span>
                    </Tooltip>
                  </InputAdornment>
                ),
              },
            }}
          />

          {/* se ofrecen las categorias que ya existen, pero deja escribir una nueva: a mano,
              "Lacteos" y "Lacteos " terminaban siendo dos categorias distintas */}
          <Autocomplete
            freeSolo
            options={categorias}
            value={form.categoria}
            onChange={(_evento, valor) => cambiar('categoria', valor ?? '')}
            onInputChange={(_evento, valor) => cambiar('categoria', valor)}
            renderInput={(params) => <TextField {...params} label="Categoria" />}
          />

          <TextField
            select
            label="Proveedor"
            value={form.proveedor_id}
            onChange={(evento) => cambiar('proveedor_id', evento.target.value)}
          >
            <MenuItem value="">Sin proveedor</MenuItem>
            {(proveedores ?? []).map((proveedor) => (
              <MenuItem key={proveedor.id} value={proveedor.id}>
                {proveedor.nombre_proveedores}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="Precio de compra"
            type="number"
            value={form.precio_compra}
            onChange={(evento) => cambiar('precio_compra', evento.target.value)}
          />

          <TextField
            label="Precio de venta"
            type="number"
            value={form.precio_venta}
            onChange={(evento) => cambiar('precio_venta', evento.target.value)}
          />

          {!editando && (
            <TextField
              label="Stock inicial"
              type="number"
              value={form.stock_actual}
              onChange={(evento) => cambiar('stock_actual', evento.target.value)}
            />
          )}

          <TextField
            label="Stock minimo"
            type="number"
            value={form.stock_minimo}
            onChange={(evento) => cambiar('stock_minimo', evento.target.value)}
            helperText="Bajo este numero se avisa"
          />

          <TextField
            label="Lote"
            value={form.lote}
            onChange={(evento) => cambiar('lote', evento.target.value)}
          />

          <TextField
            label="Fecha de vencimiento"
            type="date"
            value={form.fecha_vencimiento}
            onChange={(evento) => cambiar('fecha_vencimiento', evento.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />

          <TextField
            select
            label="Impuesto adicional"
            value={form.impuesto_adicional_codigo}
            onChange={(evento) => cambiar('impuesto_adicional_codigo', Number(evento.target.value))}
            sx={{ gridColumn: '1 / -1' }}
          >
            {OPCIONES_ILA.map((opcion) => (
              <MenuItem key={opcion.codigo} value={opcion.codigo}>
                {opcion.etiqueta}
              </MenuItem>
            ))}
          </TextField>
        </Box>

        <Box sx={{ mt: 2.5 }}>
          <CampoFoto
            imagen={form.imagen}
            onCambiar={(imagen) => setForm((previo) => ({ ...previo, imagen }))}
          />
        </Box>

        {!editando && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
            El lote y la fecha de vencimiento alimentan el semaforo sanitario. Si el producto no
            vence, dejalos vacios.
          </Typography>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onCerrar} disabled={guardando}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={guardar} disabled={guardando || faltanDatos}>
          {editando ? 'Guardar cambios' : 'Agregar'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

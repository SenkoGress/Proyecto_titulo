// src/features/sii/components/compartidos/DialogoEmitirGuia.tsx
import { useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Autocomplete from '@mui/material/Autocomplete'
import Alert from '@mui/material/Alert'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import IconButton from '@mui/material/IconButton'
import DeleteOutlined from '@mui/icons-material/DeleteOutlined'
import { formatoClp } from '@/shared/utils/formatoClp'
import { formatearRut, rutParaSii, validarRut } from '@/shared/utils/rut'
import { useInventario } from '@/features/inventario/hooks/useInventario'
import { useEmitirGuia } from '@/features/sii/hooks/useSii'
import type { ProductoInventario } from '@/features/inventario/types'
import type { ItemGuia } from '@/features/sii/types'

type Props = {
  onCerrar: () => void
}

// los tres tipos de traslado que acepta el backend
const TRASLADOS = [
  { valor: 5, etiqueta: 'Traslado interno (entre bodegas)' },
  { valor: 1, etiqueta: 'Venta' },
  { valor: 6, etiqueta: 'Otros traslados no venta' },
]

export function DialogoEmitirGuia({ onCerrar }: Props) {
  const inventario = useInventario()
  const emision = useEmitirGuia()

  const [rut, setRut] = useState('')
  const [razonSocial, setRazonSocial] = useState('')
  const [direccion, setDireccion] = useState('')
  const [comuna, setComuna] = useState('')
  const [traslado, setTraslado] = useState(5)
  const [patente, setPatente] = useState('')
  const [choferNombre, setChoferNombre] = useState('')
  const [choferRut, setChoferRut] = useState('')
  const [items, setItems] = useState<ItemGuia[]>([])

  const total = items.reduce((suma, item) => suma + item.cantidad * item.precioUnitario, 0)
  const rutOk = validarRut(rut)

  const agregar = (producto: ProductoInventario | null) => {
    if (!producto || items.some((item) => item.sku === producto.sku)) return

    setItems((previo) => [
      ...previo,
      { nombre: producto.nombre, sku: producto.sku, cantidad: 1, precioUnitario: producto.precio_venta },
    ])
  }

  const cambiarCantidad = (sku: string, cantidad: number) => {
    setItems((previo) => previo.map((item) => (item.sku === sku ? { ...item, cantidad } : item)))
  }

  const puedeEmitir =
    rutOk && razonSocial.trim() !== '' && direccion.trim() !== '' && items.length > 0 && !emision.isPending

  const emitir = () => {
    emision.mutate({
      receptorRut: rutParaSii(rut),
      receptorRazonSocial: razonSocial.trim(),
      direccionDestino: direccion.trim(),
      comunaDestino: comuna.trim() || 'SANTIAGO',
      tipoTraslado: traslado,
      patente: patente.trim() || undefined,
      choferRut: choferRut.trim() ? rutParaSii(choferRut) : undefined,
      choferNombre: choferNombre.trim() || undefined,
      items,
    })
  }

  return (
    <Dialog open onClose={onCerrar} maxWidth="sm" fullWidth>
      <DialogTitle>Emitir guia de despacho (DTE 52)</DialogTitle>

      <DialogContent dividers>
        {emision.isSuccess ? (
          <Alert severity="success">{emision.data.message}</Alert>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Alert severity="warning">
              Se emite un documento tributario real y consume un folio autorizado. No se puede anular despues.
            </Alert>

            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField
                label="RUT de quien recibe"
                size="small"
                value={rut}
                onChange={(evento) => setRut(formatearRut(evento.target.value))}
                error={rut !== '' && !rutOk}
                helperText={rut !== '' && !rutOk ? 'RUT invalido' : ' '}
                sx={{ flex: '1 1 180px' }}
              />

              <TextField
                label="Razon social"
                size="small"
                value={razonSocial}
                onChange={(evento) => setRazonSocial(evento.target.value)}
                sx={{ flex: '1 1 240px' }}
                helperText=" "
              />
            </Box>

            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField
                label="Direccion de destino"
                size="small"
                value={direccion}
                onChange={(evento) => setDireccion(evento.target.value)}
                sx={{ flex: '1 1 260px' }}
              />

              <TextField
                label="Comuna"
                size="small"
                value={comuna}
                onChange={(evento) => setComuna(evento.target.value)}
                placeholder="SANTIAGO"
                sx={{ flex: '1 1 160px' }}
              />
            </Box>

            <TextField
              select
              label="Tipo de traslado"
              size="small"
              value={traslado}
              onChange={(evento) => setTraslado(Number(evento.target.value))}
            >
              {TRASLADOS.map((opcion) => (
                <MenuItem key={opcion.valor} value={opcion.valor}>
                  {opcion.etiqueta}
                </MenuItem>
              ))}
            </TextField>

            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField
                label="Patente"
                size="small"
                value={patente}
                onChange={(evento) => setPatente(evento.target.value.toUpperCase())}
                sx={{ flex: '1 1 120px' }}
              />
              <TextField
                label="Chofer"
                size="small"
                value={choferNombre}
                onChange={(evento) => setChoferNombre(evento.target.value)}
                sx={{ flex: '1 1 180px' }}
              />
              <TextField
                label="RUT del chofer"
                size="small"
                value={choferRut}
                onChange={(evento) => setChoferRut(formatearRut(evento.target.value))}
                sx={{ flex: '1 1 150px' }}
              />
            </Box>

            <Autocomplete
              options={inventario.data ?? []}
              getOptionLabel={(producto) => `${producto.nombre} (${producto.sku})`}
              onChange={(_, producto) => agregar(producto)}
              value={null}
              renderInput={(parametros) => (
                <TextField {...parametros} label="Agregar producto al despacho" size="small" />
              )}
            />

            {items.map((item) => (
              <Paper key={item.sku} variant="outlined" sx={{ p: 1.5, display: 'flex', gap: 2, alignItems: 'center' }}>
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {item.nombre}
                  </Typography>
                  <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                    {item.sku} · {formatoClp(item.precioUnitario)}
                  </Typography>
                </Box>

                <TextField
                  type="number"
                  size="small"
                  label="Cantidad"
                  value={item.cantidad}
                  onChange={(evento) => cambiarCantidad(item.sku, Math.max(1, Number(evento.target.value)))}
                  sx={{ width: 100 }}
                />

                <IconButton
                  size="small"
                  onClick={() => setItems((previo) => previo.filter((otro) => otro.sku !== item.sku))}
                >
                  <DeleteOutlined fontSize="small" />
                </IconButton>
              </Paper>
            ))}

            {items.length > 0 && (
              <Typography variant="subtitle1" sx={{ fontWeight: 700, textAlign: 'right' }}>
                Total despachado: {formatoClp(total)}
              </Typography>
            )}

            {emision.isError && <Alert severity="error">{emision.error.message}</Alert>}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        {emision.isSuccess ? (
          <Button variant="contained" onClick={onCerrar}>
            Listo
          </Button>
        ) : (
          <>
            <Button onClick={onCerrar}>Cancelar</Button>
            <Button variant="contained" disabled={!puedeEmitir} onClick={emitir}>
              {emision.isPending ? 'Emitiendo...' : 'Emitir guia'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  )
}

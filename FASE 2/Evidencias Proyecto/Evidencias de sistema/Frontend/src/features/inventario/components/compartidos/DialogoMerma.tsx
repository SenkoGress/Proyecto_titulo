// src/features/inventario/components/compartidos/DialogoMerma.tsx
import { useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Box from '@mui/material/Box'
import Alert from '@mui/material/Alert'
import Typography from '@mui/material/Typography'
import { obtenerMensajeError } from '@/lib/api/apiError'
import { useRegistrarMerma } from '@/features/inventario/hooks/useInventario'
import type { MotivoMerma, ProductoInventario } from '@/features/inventario/types'

type Props = {
  abierto: boolean
  onCerrar: () => void
  producto: ProductoInventario | null
}

const MOTIVOS: { valor: MotivoMerma; etiqueta: string }[] = [
  { valor: 'vencimiento', etiqueta: 'Vencido' },
  { valor: 'rotura', etiqueta: 'Roto o quebrado' },
  { valor: 'deterioro', etiqueta: 'En mal estado' },
  { valor: 'robo', etiqueta: 'Robo o perdida' },
  { valor: 'otro', etiqueta: 'Otro' },
]

// baja de producto que no se puede vender, descuenta stock
export function DialogoMerma({ abierto, onCerrar, producto }: Props) {
  const [cantidad, setCantidad] = useState('')
  const [motivo, setMotivo] = useState<MotivoMerma>('vencimiento')
  const [observaciones, setObservaciones] = useState('')
  const registrar = useRegistrarMerma()

  if (!producto) return null

  const stockActual = Number(producto.stock_actual)
  const cantidadNumero = Number(cantidad)
  const cantidadValida = cantidad.trim() !== '' && cantidadNumero > 0
  const pasaDelStock = cantidadValida && cantidadNumero > stockActual

  async function guardar() {
    if (!producto) return
    await registrar.mutateAsync({
      producto_id: producto.id,
      cantidad: cantidadNumero,
      motivo,
      observaciones: observaciones.trim(),
    })
    onCerrar()
  }

  return (
    <Dialog open={abierto} onClose={onCerrar} maxWidth="xs" fullWidth>
      <DialogTitle>Registrar merma</DialogTitle>

      <DialogContent dividers>
        {registrar.error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {obtenerMensajeError(registrar.error)}
          </Alert>
        )}

        <Typography variant="subtitle2">{producto.nombre}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Quedan {stockActual} unidades
        </Typography>

        <Box sx={{ display: 'grid', gap: 2 }}>
          <TextField
            label="Cantidad a dar de baja"
            type="number"
            value={cantidad}
            onChange={(evento) => setCantidad(evento.target.value)}
            autoFocus
            required
          />

          <TextField
            select
            label="Motivo"
            value={motivo}
            onChange={(evento) => setMotivo(evento.target.value as MotivoMerma)}
          >
            {MOTIVOS.map((opcion) => (
              <MenuItem key={opcion.valor} value={opcion.valor}>
                {opcion.etiqueta}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="Detalle"
            value={observaciones}
            onChange={(evento) => setObservaciones(evento.target.value)}
            multiline
            rows={2}
            placeholder="Opcional"
          />
        </Box>

        {pasaDelStock && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            Estas dando de baja mas de lo que hay. El stock va a quedar en cero.
          </Alert>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onCerrar} disabled={registrar.isPending}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          color="warning"
          onClick={guardar}
          disabled={registrar.isPending || !cantidadValida}
        >
          Registrar baja
        </Button>
      </DialogActions>
    </Dialog>
  )
}

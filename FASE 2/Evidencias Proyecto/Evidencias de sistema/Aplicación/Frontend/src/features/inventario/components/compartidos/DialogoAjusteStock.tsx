// src/features/inventario/components/compartidos/DialogoAjusteStock.tsx
import { useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Box from '@mui/material/Box'
import Alert from '@mui/material/Alert'
import Typography from '@mui/material/Typography'
import { obtenerMensajeError } from '@/lib/api/apiError'
import { useAjustarStock } from '@/features/inventario/hooks/useInventario'
import type { ProductoInventario } from '@/features/inventario/types'

type Props = {
  abierto: boolean
  onCerrar: () => void
  producto: ProductoInventario | null
}

// conteo fisico: el cajero cuenta lo que hay y el sistema calcula la diferencia
export function DialogoAjusteStock({ abierto, onCerrar, producto }: Props) {
  const [contado, setContado] = useState('')
  const [motivo, setMotivo] = useState('')
  const ajustar = useAjustarStock()

  if (!producto) return null

  const stockSistema = Number(producto.stock_actual)
  const hayConteo = contado.trim() !== '' && !Number.isNaN(Number(contado)) && Number(contado) >= 0
  const diferencia = hayConteo ? Number(contado) - stockSistema : 0

  async function guardar() {
    if (!producto) return
    await ajustar.mutateAsync({
      id: producto.id,
      nuevo_stock: Number(contado),
      motivo: motivo.trim() || 'Conteo fisico',
    })
    onCerrar()
  }

  return (
    <Dialog open={abierto} onClose={onCerrar} maxWidth="xs" fullWidth>
      <DialogTitle>Ajustar stock</DialogTitle>

      <DialogContent dividers>
        {ajustar.error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {obtenerMensajeError(ajustar.error)}
          </Alert>
        )}

        <Typography variant="subtitle2">{producto.nombre}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          El sistema tiene {stockSistema} unidades
        </Typography>

        <Box sx={{ display: 'grid', gap: 2 }}>
          <TextField
            label="Unidades contadas"
            type="number"
            value={contado}
            onChange={(evento) => setContado(evento.target.value)}
            autoFocus
            required
          />

          <TextField
            label="Motivo"
            value={motivo}
            onChange={(evento) => setMotivo(evento.target.value)}
            placeholder="Conteo fisico"
          />
        </Box>

        {hayConteo && diferencia !== 0 && (
          <Alert severity={diferencia < 0 ? 'warning' : 'info'} sx={{ mt: 2 }}>
            {diferencia < 0
              ? `Faltan ${Math.abs(diferencia)} unidades respecto al sistema.`
              : `Sobran ${diferencia} unidades respecto al sistema.`}
          </Alert>
        )}

        {hayConteo && diferencia === 0 && (
          <Alert severity="success" sx={{ mt: 2 }}>
            El conteo coincide con el sistema.
          </Alert>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onCerrar} disabled={ajustar.isPending}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={guardar} disabled={ajustar.isPending || !hayConteo}>
          Guardar ajuste
        </Button>
      </DialogActions>
    </Dialog>
  )
}

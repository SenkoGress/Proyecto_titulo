// src/features/pos/components/compartidos/DialogoReceptorFactura.tsx
import { useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { formatearRut, validarRut } from '@/shared/utils/rut'
import { useCarritoStore } from '@/features/pos/stores/carritoStore'
import type { ReceptorEmpresa } from '@/features/pos/types'

type Props = {
  onCerrar: () => void
}

const VACIO: ReceptorEmpresa = {
  rut: '',
  razon_social: '',
  giro: '',
  direccion: '',
  comuna: '',
  ciudad: '',
}

// datos que el sii exige en el receptor de una factura
export function DialogoReceptorFactura({ onCerrar }: Props) {
  const receptor = useCarritoStore((estado) => estado.receptorEmpresa)
  const fijarReceptor = useCarritoStore((estado) => estado.fijarReceptorEmpresa)
  const cambiarTipo = useCarritoStore((estado) => estado.cambiarTipoComprobante)

  const [form, setForm] = useState<ReceptorEmpresa>(receptor ?? VACIO)

  const cambiar = (campo: keyof ReceptorEmpresa, valor: string) =>
    setForm((anterior) => ({ ...anterior, [campo]: valor }))

  const rutValido = validarRut(form.rut)
  const puedeGuardar = rutValido && form.razon_social.trim().length > 0 && form.giro.trim().length > 0

  const guardar = () => {
    fijarReceptor({ ...form, rut: formatearRut(form.rut) })
    onCerrar()
  }

  // si cancela sin datos, se vuelve a boleta para no dejar la venta trabada
  const cancelar = () => {
    if (!receptor) cambiarTipo('BOLETA')
    onCerrar()
  }

  return (
    <Dialog open onClose={cancelar} maxWidth="sm" fullWidth>
      <DialogTitle>Datos para la factura</DialogTitle>

      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 0.5 }}>
          <TextField
            label="RUT de la empresa"
            value={form.rut}
            onChange={(evento) => cambiar('rut', evento.target.value)}
            onBlur={() => form.rut && cambiar('rut', formatearRut(form.rut))}
            error={form.rut.length > 0 && !rutValido}
            helperText={form.rut.length > 0 && !rutValido ? 'RUT invalido' : 'Obligatorio'}
            required
            fullWidth
            autoFocus
          />

          <TextField
            label="Razon social"
            value={form.razon_social}
            onChange={(evento) => cambiar('razon_social', evento.target.value)}
            helperText="Obligatorio"
            required
            fullWidth
          />

          <TextField
            label="Giro"
            value={form.giro}
            onChange={(evento) => cambiar('giro', evento.target.value)}
            helperText="Obligatorio para el SII"
            required
            fullWidth
          />

          <TextField
            label="Direccion"
            value={form.direccion}
            onChange={(evento) => cambiar('direccion', evento.target.value)}
            fullWidth
          />

          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Comuna"
              value={form.comuna}
              onChange={(evento) => cambiar('comuna', evento.target.value)}
              fullWidth
            />
            <TextField
              label="Ciudad"
              value={form.ciudad}
              onChange={(evento) => cambiar('ciudad', evento.target.value)}
              fullWidth
            />
          </Box>

          <Typography variant="caption" color="text.secondary">
            El sistema no guarda clientes: estos datos van solo en esta factura y hay que escribirlos en cada venta.
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={cancelar}>Cancelar</Button>
        <Button variant="contained" onClick={guardar} disabled={!puedeGuardar}>
          Usar estos datos
        </Button>
      </DialogActions>
    </Dialog>
  )
}

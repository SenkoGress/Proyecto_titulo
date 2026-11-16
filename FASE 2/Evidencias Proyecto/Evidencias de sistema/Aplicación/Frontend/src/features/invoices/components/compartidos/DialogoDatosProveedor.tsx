// src/features/invoices/components/compartidos/DialogoDatosProveedor.tsx
import { useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import type { DatosProveedorFactura } from '@/features/invoices/utils/datosProveedor'

type Props = {
  razonSocial: string
  rut: string
  datos: DatosProveedorFactura
  onGuardar: (datos: DatosProveedorFactura) => void
  onCerrar: () => void
}

// lo que la factura no trae del proveedor: se completa aqui, nada se inventa
export function DialogoDatosProveedor({ razonSocial, rut, datos, onGuardar, onCerrar }: Props) {
  const [form, setForm] = useState(datos)

  const cambiar = (campo: keyof DatosProveedorFactura, valor: string) =>
    setForm((anterior) => ({ ...anterior, [campo]: valor }))

  const correoInvalido = form.email.trim().length > 0 && !/^\S+@\S+\.\S+$/.test(form.email.trim())

  return (
    <Dialog open onClose={onCerrar} maxWidth="sm" fullWidth>
      <DialogTitle>Datos del proveedor</DialogTitle>

      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            <strong>{razonSocial}</strong> (RUT {rut}) es un proveedor nuevo. La factura no trae estos datos:
            complétalos ahora o déjalos en blanco y edítalos después en Proveedores.
          </Typography>

          <TextField
            label="Giro"
            value={form.giro}
            onChange={(evento) => cambiar('giro', evento.target.value)}
            placeholder="Distribucion mayorista"
            autoFocus
            fullWidth
          />

          <TextField
            label="Direccion"
            value={form.direccion}
            onChange={(evento) => cambiar('direccion', evento.target.value)}
            fullWidth
          />

          <TextField
            label="Telefono / WhatsApp"
            value={form.telefono}
            onChange={(evento) => cambiar('telefono', evento.target.value)}
            placeholder="+56 9 1234 5678"
            fullWidth
          />

          <TextField
            label="Correo"
            type="email"
            value={form.email}
            onChange={(evento) => cambiar('email', evento.target.value)}
            error={correoInvalido}
            helperText={correoInvalido ? 'Revisa el correo' : 'A este correo se envian los pedidos de reposicion'}
            fullWidth
          />

          <TextField
            label="Dias de visita"
            value={form.dias_visita}
            onChange={(evento) => cambiar('dias_visita', evento.target.value)}
            placeholder="Martes y Jueves"
            fullWidth
          />
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onCerrar}>Completar despues</Button>
        <Button variant="contained" onClick={() => onGuardar(form)} disabled={correoInvalido}>
          Guardar datos
        </Button>
      </DialogActions>
    </Dialog>
  )
}

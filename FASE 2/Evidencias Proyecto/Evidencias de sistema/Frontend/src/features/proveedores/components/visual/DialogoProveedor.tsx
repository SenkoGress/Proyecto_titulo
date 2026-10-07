// src/features/proveedores/components/visual/DialogoProveedor.tsx
import { useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import Typography from '@mui/material/Typography'
import { formatearRut, validarRut } from '@/shared/utils/rut'
import { useActualizarProveedor, useCrearProveedor } from '@/features/proveedores/hooks/useProveedores'
import type { FichaProveedor } from '@/features/proveedores/utils/fichaProveedor'

type Props = {
  editando: FichaProveedor | null // null = alta nueva
  onCerrar: () => void
}

const FORM_VACIO = {
  rut_proveedor: '',
  nombre_proveedores: '',
  giro: '',
  direccion: '',
  telefono: '',
  email: '',
  dias_visita_proveedores: '',
}

// el dialogo se monta recien al abrirlo, asi el formulario parte limpio cada vez
function valoresIniciales(editando: FichaProveedor | null) {
  if (!editando) return FORM_VACIO

  return {
    rut_proveedor: editando.rut_proveedor,
    nombre_proveedores: editando.nombre_proveedores,
    giro: editando.giro,
    direccion: editando.direccion,
    telefono: editando.telefono,
    email: editando.email ?? '',
    dias_visita_proveedores: editando.dias_visita_proveedores,
  }
}

// alta y edicion de proveedor (solo los campos que el backend guarda de verdad)
export function DialogoProveedor({ editando, onCerrar }: Props) {
  const [form, setForm] = useState(() => valoresIniciales(editando))
  const crear = useCrearProveedor()
  const actualizar = useActualizarProveedor()

  const cambiar = (campo: keyof typeof FORM_VACIO, valor: string) =>
    setForm((anterior) => ({ ...anterior, [campo]: valor }))

  const rutValido = validarRut(form.rut_proveedor)
  const nombreValido = form.nombre_proveedores.trim().length > 0
  const puedeGuardar = nombreValido && (editando ? true : rutValido)
  const guardando = crear.isPending || actualizar.isPending
  const error = crear.error ?? actualizar.error

  const guardar = async () => {
    if (editando) {
      await actualizar.mutateAsync({
        id: editando.id,
        cambios: {
          nombre_proveedores: form.nombre_proveedores.trim(),
          giro: form.giro.trim() || undefined,
          direccion: form.direccion.trim() || undefined,
          telefono: form.telefono.trim() || undefined,
          email: form.email.trim() || undefined,
          dias_visita_proveedores: form.dias_visita_proveedores.trim() || undefined,
        },
      })
    } else {
      await crear.mutateAsync({
        rut_proveedor: formatearRut(form.rut_proveedor),
        nombre_proveedores: form.nombre_proveedores.trim(),
        giro: form.giro.trim() || undefined,
        direccion: form.direccion.trim() || undefined,
        telefono: form.telefono.trim() || undefined,
        email: form.email.trim() || undefined,
        dias_visita_proveedores: form.dias_visita_proveedores.trim() || undefined,
      })
    }

    onCerrar()
  }

  return (
    <Dialog open onClose={onCerrar} maxWidth="sm" fullWidth>
      <DialogTitle>{editando ? 'Editar proveedor' : 'Nuevo proveedor'}</DialogTitle>

      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 0.5 }}>
          <TextField
            label="RUT del proveedor"
            value={form.rut_proveedor}
            onChange={(evento) => cambiar('rut_proveedor', evento.target.value)}
            onBlur={() => form.rut_proveedor && cambiar('rut_proveedor', formatearRut(form.rut_proveedor))}
            disabled={Boolean(editando)} // el rut es la clave unica, no se puede cambiar
            error={form.rut_proveedor.length > 0 && !rutValido}
            helperText={
              editando
                ? 'El RUT identifica al proveedor y no se puede modificar'
                : form.rut_proveedor.length > 0 && !rutValido
                  ? 'RUT invalido'
                  : 'Obligatorio'
            }
            required
            fullWidth
          />

          <TextField
            label="Razon social"
            value={form.nombre_proveedores}
            onChange={(evento) => cambiar('nombre_proveedores', evento.target.value)}
            helperText="Obligatorio"
            required
            fullWidth
          />

          <TextField
            label="Giro"
            value={form.giro}
            onChange={(evento) => cambiar('giro', evento.target.value)}
            placeholder="Distribucion mayorista"
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
            helperText="Para el boton de pedido tiene que ser un celular chileno"
            fullWidth
          />

          <TextField
            label="Correo"
            type="email"
            value={form.email}
            onChange={(evento) => cambiar('email', evento.target.value)}
            fullWidth
          />

          <TextField
            label="Dias de visita"
            value={form.dias_visita_proveedores}
            onChange={(evento) => cambiar('dias_visita_proveedores', evento.target.value)}
            placeholder="Martes y Jueves"
            helperText="El sistema lee los dias de este texto para calcular la proxima visita"
            fullWidth
          />

          <Typography variant="caption" color="text.secondary">
            El backend todavia no guarda condicion de pago, pedido minimo ni nombre del vendedor de ruta.
          </Typography>

          {error && <Alert severity="error">No se pudo guardar: {error.message}</Alert>}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onCerrar} disabled={guardando}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={guardar} disabled={!puedeGuardar || guardando}>
          {guardando ? 'Guardando...' : 'Guardar'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

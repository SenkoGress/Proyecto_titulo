// src/features/auth/components/DialogoEditarUsuario.tsx
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
import { useEditarUsuario } from '@/features/auth/hooks/useAuth'
import type { CambioDeUsuario, RolUsuario, Usuario } from '@/features/auth/types'

type Props = {
  usuario: Usuario
  esElUltimoAdmin: boolean
  onCerrar: () => void
}

const LARGO_MINIMO = 8

// el admin corrige los datos de alguien del local. La clave es opcional: se manda solo si la
// escribe, porque el backend acepta cambios parciales
export function DialogoEditarUsuario({ usuario, esElUltimoAdmin, onCerrar }: Props) {
  const [nombre, setNombre] = useState(usuario.nombre)
  const [email, setEmail] = useState(usuario.email)
  const [rol, setRol] = useState<RolUsuario>(usuario.rol)
  const [password, setPassword] = useState('')

  const editar = useEditarUsuario()

  const claveCorta = password.length > 0 && password.length < LARGO_MINIMO
  const completo = nombre.trim() !== '' && email.trim() !== '' && !claveCorta

  // el backend responde 409 si el comercio queda sin administrador, y conviene decirlo antes
  const quitaAlUltimoAdmin = esElUltimoAdmin && rol !== 'admin'

  async function guardar() {
    const cambios: CambioDeUsuario = {}
    if (nombre.trim() !== usuario.nombre) cambios.nombre = nombre.trim()
    if (email.trim() !== usuario.email) cambios.email = email.trim()
    if (rol !== usuario.rol) cambios.rol = rol
    if (password.length >= LARGO_MINIMO) cambios.password = password

    if (Object.keys(cambios).length === 0) {
      onCerrar()
      return
    }

    await editar.mutateAsync({ id: usuario.id, cambios })
    onCerrar()
  }

  return (
    <Dialog open onClose={onCerrar} maxWidth="xs" fullWidth>
      <DialogTitle>Editar a {usuario.nombre}</DialogTitle>

      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 0.5 }}>
          <TextField
            label="Nombre"
            value={nombre}
            onChange={(evento) => setNombre(evento.target.value)}
            required
            fullWidth
          />

          <TextField
            label="Correo"
            type="email"
            value={email}
            onChange={(evento) => setEmail(evento.target.value)}
            required
            fullWidth
          />

          <TextField
            label="Rol"
            select
            value={rol}
            onChange={(evento) => setRol(evento.target.value as RolUsuario)}
            fullWidth
          >
            <MenuItem value="cajero">Cajero</MenuItem>
            <MenuItem value="admin">Administrador</MenuItem>
          </TextField>

          {quitaAlUltimoAdmin && (
            <Alert severity="warning">
              Es el unico administrador activo del local. Si le cambias el rol, nadie podria
              administrar el sistema, asi que el servidor no lo va a permitir.
            </Alert>
          )}

          <TextField
            label="Clave nueva"
            type="password"
            value={password}
            onChange={(evento) => setPassword(evento.target.value)}
            error={claveCorta}
            helperText={
              claveCorta
                ? `La clave debe tener al menos ${LARGO_MINIMO} caracteres`
                : 'Dejala en blanco si no quieres cambiarla'
            }
            fullWidth
          />

          <Typography variant="caption" color="text.secondary">
            Si le cambias la clave, la persona tendra que entrar de nuevo con la clave nueva.
          </Typography>

          {editar.isError && <Alert severity="error">{obtenerMensajeError(editar.error)}</Alert>}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onCerrar}>Cancelar</Button>
        <Button
          variant="contained"
          onClick={guardar}
          disabled={!completo || editar.isPending || quitaAlUltimoAdmin}
        >
          {editar.isPending ? 'Guardando...' : 'Guardar'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

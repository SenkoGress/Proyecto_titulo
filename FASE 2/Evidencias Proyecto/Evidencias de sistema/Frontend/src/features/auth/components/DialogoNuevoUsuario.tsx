// src/features/auth/components/DialogoNuevoUsuario.tsx
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
import InputAdornment from '@mui/material/InputAdornment'
import IconButton from '@mui/material/IconButton'
import Visibility from '@mui/icons-material/Visibility'
import VisibilityOff from '@mui/icons-material/VisibilityOff'
import { obtenerMensajeError } from '@/lib/api/apiError'
import { useCrearUsuario } from '@/features/auth/hooks/useAuth'
import type { RolUsuario } from '@/features/auth/types'

type Props = {
  abierto: boolean
  onCerrar: () => void
}

const LARGO_MINIMO = 8

// el admin da de alta a la gente que trabaja en el local
export function DialogoNuevoUsuario({ abierto, onCerrar }: Props) {
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rol, setRol] = useState<RolUsuario>('cajero')
  const [verClave, setVerClave] = useState(false)
  const crear = useCrearUsuario()

  const claveCorta = password.length > 0 && password.length < LARGO_MINIMO
  const completo = nombre.trim() !== '' && email.trim() !== '' && password.length >= LARGO_MINIMO

  async function guardar() {
    await crear.mutateAsync({ nombre: nombre.trim(), email: email.trim(), password, rol })
    onCerrar()
  }

  return (
    <Dialog open={abierto} onClose={onCerrar} maxWidth="xs" fullWidth>
      <DialogTitle>Agregar persona</DialogTitle>

      <DialogContent dividers>
        {crear.error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {obtenerMensajeError(crear.error)}
          </Alert>
        )}

        <Box sx={{ display: 'grid', gap: 2 }}>
          <TextField
            label="Nombre"
            value={nombre}
            onChange={(evento) => setNombre(evento.target.value)}
            autoFocus
            required
          />

          <TextField
            label="Correo"
            type="email"
            value={email}
            onChange={(evento) => setEmail(evento.target.value)}
            required
            helperText="Con este correo va a entrar al sistema"
          />

          <TextField
            select
            label="Rol"
            value={rol}
            onChange={(evento) => setRol(evento.target.value as RolUsuario)}
            helperText={
              rol === 'admin'
                ? 'Ve todo: ventas, margenes, proveedores y configuracion'
                : 'Ve la caja, el inventario y el cierre de turno'
            }
          >
            <MenuItem value="cajero">Cajero</MenuItem>
            <MenuItem value="admin">Administrador</MenuItem>
          </TextField>

          <TextField
            label="Clave"
            type={verClave ? 'text' : 'password'}
            value={password}
            onChange={(evento) => setPassword(evento.target.value)}
            required
            error={claveCorta}
            helperText={
              claveCorta ? `Al menos ${LARGO_MINIMO} caracteres` : 'Entregasela a la persona para que entre'
            }
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setVerClave((previo) => !previo)}
                      edge="end"
                      aria-label={verClave ? 'Ocultar la clave' : 'Mostrar la clave'}
                    >
                      {verClave ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onCerrar} disabled={crear.isPending}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={guardar} disabled={!completo || crear.isPending}>
          {crear.isPending ? 'Creando...' : 'Crear cuenta'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

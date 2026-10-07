// src/features/auth/components/FormularioRegistro.tsx
import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import InputAdornment from '@mui/material/InputAdornment'
import IconButton from '@mui/material/IconButton'
import Alert from '@mui/material/Alert'
import Link from '@mui/material/Link'
import Typography from '@mui/material/Typography'
import Visibility from '@mui/icons-material/Visibility'
import VisibilityOff from '@mui/icons-material/VisibilityOff'
import { obtenerMensajeError } from '@/lib/api/apiError'
import { useRegistrarUsuario } from '@/features/auth/hooks/useAuth'
import type { RolUsuario } from '@/features/auth/types'

type Props = {
  onIrALogin: () => void
}

const LARGO_MINIMO = 8

export function FormularioRegistro({ onIrALogin }: Props) {
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [repetida, setRepetida] = useState('')
  const [rol, setRol] = useState<RolUsuario>('cajero')
  const [verClave, setVerClave] = useState(false)
  const registro = useRegistrarUsuario()

  const claveCorta = password.length > 0 && password.length < LARGO_MINIMO
  const noCoinciden = repetida.length > 0 && password !== repetida
  const completo =
    nombre.trim() !== '' && email.trim() !== '' && password.length >= LARGO_MINIMO && password === repetida

  function enviar(evento: React.FormEvent) {
    evento.preventDefault()
    if (!completo) return
    registro.mutate({ nombre: nombre.trim(), email: email.trim(), password, rol })
  }

  return (
    <Box component="form" onSubmit={enviar} sx={{ display: 'grid', gap: 2 }}>
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Crear cuenta
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Para sumar a alguien al local
        </Typography>
      </Box>

      {registro.error && <Alert severity="error">{obtenerMensajeError(registro.error)}</Alert>}

      <TextField
        label="Nombre"
        value={nombre}
        onChange={(evento) => setNombre(evento.target.value)}
        autoComplete="name"
        autoFocus
        required
        fullWidth
      />

      <TextField
        label="Correo"
        type="email"
        value={email}
        onChange={(evento) => setEmail(evento.target.value)}
        autoComplete="email"
        required
        fullWidth
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
        fullWidth
      >
        <MenuItem value="cajero">Cajero</MenuItem>
        <MenuItem value="admin">Administrador</MenuItem>
      </TextField>

      <TextField
        label="Clave"
        type={verClave ? 'text' : 'password'}
        value={password}
        onChange={(evento) => setPassword(evento.target.value)}
        autoComplete="new-password"
        required
        fullWidth
        error={claveCorta}
        helperText={claveCorta ? `Al menos ${LARGO_MINIMO} caracteres` : ' '}
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

      <TextField
        label="Repetir la clave"
        type={verClave ? 'text' : 'password'}
        value={repetida}
        onChange={(evento) => setRepetida(evento.target.value)}
        autoComplete="new-password"
        required
        fullWidth
        error={noCoinciden}
        helperText={noCoinciden ? 'Las dos claves no son iguales' : ' '}
      />

      <Button type="submit" variant="contained" size="large" disabled={!completo || registro.isPending}>
        {registro.isPending ? 'Creando...' : 'Crear cuenta'}
      </Button>

      <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
        ¿Ya tienes cuenta?{' '}
        <Link component="button" type="button" onClick={onIrALogin}>
          Entrar
        </Link>
      </Typography>
    </Box>
  )
}

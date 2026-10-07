// src/features/auth/components/FormularioLogin.tsx
import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import IconButton from '@mui/material/IconButton'
import Alert from '@mui/material/Alert'
import Link from '@mui/material/Link'
import Typography from '@mui/material/Typography'
import Visibility from '@mui/icons-material/Visibility'
import VisibilityOff from '@mui/icons-material/VisibilityOff'
import { obtenerMensajeError } from '@/lib/api/apiError'
import { useIniciarSesion } from '@/features/auth/hooks/useAuth'

type Props = {
  onIrARegistro: () => void
}

export function FormularioLogin({ onIrARegistro }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [verClave, setVerClave] = useState(false)
  const sesion = useIniciarSesion()

  const faltanDatos = !email.trim() || !password

  function enviar(evento: React.FormEvent) {
    evento.preventDefault()
    if (faltanDatos) return
    sesion.mutate({ email: email.trim(), password })
  }

  return (
    <Box component="form" onSubmit={enviar} sx={{ display: 'grid', gap: 2 }}>
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Entrar
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Ingresa con tu correo y tu clave
        </Typography>
      </Box>

      {sesion.error && <Alert severity="error">{obtenerMensajeError(sesion.error)}</Alert>}

      <TextField
        label="Correo"
        type="email"
        value={email}
        onChange={(evento) => setEmail(evento.target.value)}
        autoComplete="username"
        autoFocus
        required
        fullWidth
      />

      <TextField
        label="Clave"
        type={verClave ? 'text' : 'password'}
        value={password}
        onChange={(evento) => setPassword(evento.target.value)}
        autoComplete="current-password"
        required
        fullWidth
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

      <Button
        type="submit"
        variant="contained"
        size="large"
        disabled={faltanDatos || sesion.isPending}
      >
        {sesion.isPending ? 'Entrando...' : 'Entrar'}
      </Button>

      <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
        ¿No tienes cuenta?{' '}
        <Link component="button" type="button" onClick={onIrARegistro}>
          Crear una
        </Link>
      </Typography>
    </Box>
  )
}

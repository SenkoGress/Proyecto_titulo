// src/features/auth/components/FormularioLogin.tsx
import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import IconButton from '@mui/material/IconButton'
import Alert from '@mui/material/Alert'
import Typography from '@mui/material/Typography'
import Visibility from '@mui/icons-material/Visibility'
import VisibilityOff from '@mui/icons-material/VisibilityOff'
import { obtenerMensajeError } from '@/lib/api/apiError'
import { useIniciarSesion } from '@/features/auth/hooks/useAuth'
import { DialogoRecuperarClave } from '@/features/auth/components/DialogoRecuperarClave'

export function FormularioLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [verClave, setVerClave] = useState(false)
  const [recuperando, setRecuperando] = useState(false)
  const [avisoClave, setAvisoClave] = useState('')
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
      {avisoClave && !sesion.error && <Alert severity="success">{avisoClave}</Alert>}

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

      {/* la onda de foco de MUI late mas chica que el boton: el foco se marca con el fondo completo */}
      <Button
        onClick={() => setRecuperando(true)}
        disableFocusRipple
        sx={{ justifySelf: 'center', '&.Mui-focusVisible': { bgcolor: 'action.focus' } }}
      >
        He olvidado mi contraseña
      </Button>

      <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
        Las cuentas las crea el administrador del local
      </Typography>

      {recuperando && (
        <DialogoRecuperarClave
          correoInicial={email.trim()}
          onCerrar={() => setRecuperando(false)}
          onClaveCambiada={(mensaje) => {
            setRecuperando(false)
            setPassword('')
            setAvisoClave(mensaje)
          }}
        />
      )}
    </Box>
  )
}

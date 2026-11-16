// src/features/configuracion/components/SeccionClave.tsx
import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Alert from '@mui/material/Alert'
import Typography from '@mui/material/Typography'
import LockOutlined from '@mui/icons-material/LockOutlined'
import { Seccion } from '@/features/configuracion/components/Seccion'
import { useCambiarClave } from '@/features/auth/hooks/useAuth'
import { useHaySesion } from '@/features/auth/stores/sesionStore'
import { obtenerMensajeError } from '@/lib/api/apiError'

const MINIMO = 8

// cada uno cambia su propia clave
export function SeccionClave() {
  const haySesion = useHaySesion()
  const cambiar = useCambiarClave()

  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [repetida, setRepetida] = useState('')

  const cortaAviso = nueva !== '' && nueva.length < MINIMO ? `Al menos ${MINIMO} caracteres` : ' '
  const noCoincide = repetida !== '' && repetida !== nueva
  const repetidaAviso = noCoincide ? 'Las dos claves nuevas no son iguales' : ' '
  const esLaMisma = nueva !== '' && nueva === actual

  const listo =
    actual !== '' && nueva.length >= MINIMO && repetida === nueva && !esLaMisma

  function guardar() {
    cambiar.mutate(
      { password_actual: actual, password_nueva: nueva },
      {
        onSuccess: () => {
          setActual('')
          setNueva('')
          setRepetida('')
        },
      },
    )
  }

  return (
    <Seccion
      titulo="Mi clave"
      descripcion="Cambia la clave con la que entras al sistema."
      icono={<LockOutlined />}
      origen="servidor"
    >
      {!haySesion ? (
        <Alert severity="info">
          Para cambiar la clave hay que entrar con usuario y clave. Hoy el sistema parte sin pedirlas.
        </Alert>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, maxWidth: 420 }}>
          <TextField
            label="Clave actual"
            type="password"
            size="small"
            value={actual}
            onChange={(evento) => setActual(evento.target.value)}
            autoComplete="current-password"
          />

          <TextField
            label="Clave nueva"
            type="password"
            size="small"
            value={nueva}
            onChange={(evento) => setNueva(evento.target.value)}
            error={nueva !== '' && nueva.length < MINIMO}
            helperText={cortaAviso}
            autoComplete="new-password"
          />

          <TextField
            label="Repetir la clave nueva"
            type="password"
            size="small"
            value={repetida}
            onChange={(evento) => setRepetida(evento.target.value)}
            error={noCoincide}
            helperText={repetidaAviso}
            autoComplete="new-password"
          />

          {esLaMisma && (
            <Alert severity="warning">La clave nueva tiene que ser distinta de la actual.</Alert>
          )}

          <Button
            variant="contained"
            onClick={guardar}
            disabled={!listo || cambiar.isPending}
            sx={{ alignSelf: 'flex-start', mt: 0.5 }}
          >
            {cambiar.isPending ? 'Cambiando...' : 'Cambiar clave'}
          </Button>

          {cambiar.isSuccess && <Alert severity="success">{cambiar.data.message}</Alert>}

          {cambiar.isError && <Alert severity="error">{obtenerMensajeError(cambiar.error)}</Alert>}

          <Typography variant="caption" color="text.secondary">
            La sesion sigue abierta despues del cambio. La clave nueva se usa la proxima vez que entres.
          </Typography>
        </Box>
      )}
    </Seccion>
  )
}
